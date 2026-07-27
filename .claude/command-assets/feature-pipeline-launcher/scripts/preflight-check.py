#!/usr/bin/env python3
"""
dev-pipeline environment preflight checker.

Detects database type from .prizmkit/plans/feature-list.json / .prizmkit/config.json,
verifies env vars, tests connectivity, and checks migration status.

Usage:
    python3 preflight-check.py [.prizmkit/plans/feature-list.json]

Output: PREFLIGHT lines to stdout (✓ / ⚠ / ℹ), JSON summary to stderr.
Exit code: 0 = all clear, 1 = warnings found, 2 = error.
"""

import json
import glob
import os
import re
import subprocess
import sys

# ── Config ──────────────────────────────────────────────────────

ENV_FILES = [".env.local", ".env", ".env.development.local", ".env.development"]

# (group_label, regex_pattern) — matched against env var names.
# IMPORTANT: use non-capturing groups (?:...) inside patterns so that
# group(1) in the scan regex captures the full variable name.
DB_VAR_PATTERNS = [
    ("SUPABASE_URL",  r"(?:NEXT_PUBLIC_)?SUPABASE_URL"),
    ("SUPABASE_KEY",  r"(?:NEXT_PUBLIC_)?SUPABASE_(?:ANON_KEY|SERVICE_ROLE_KEY)"),
    ("DATABASE_URL",  r"DATABASE_URL"),
    ("DB_CONNECTION", r"DB_(?:HOST|CONNECTION|URL|PORT|NAME|USER|PASSWORD)"),
    ("FIREBASE",      r"(?:NEXT_PUBLIC_)?FIREBASE_(?:API_KEY|PROJECT_ID|AUTH_DOMAIN)"),
    ("MONGODB",       r"MONGO(?:DB)?_(?:URI|URL|CONNECTION)"),
    ("REDIS",         r"REDIS_(?:URL|HOST|PORT)"),
    ("MYSQL",         r"(?:MYSQL|PLANETSCALE)_(?:URL|HOST|DATABASE)"),
    ("POSTGRES",      r"(?:PG|POSTGRES(?:QL)?)_(?:URL|HOST|CONNECTION)"),
]

DB_KEYWORDS = [
    "migration", "database", "create table", "table", "rls",
    "storage bucket", "schema", "model", "prisma", "drizzle",
    "sequelize", "typeorm", "supabase", "firebase", "mongodb",
    "postgres", "mysql", "sqlite", "redis",
]

warnings = []
passes = []
infos = []


def out(level, msg):
    """Print a preflight line and collect it."""
    print(f"PREFLIGHT {level} {msg}")
    if level == "⚠":
        warnings.append(msg)
    elif level == "✓":
        passes.append(msg)
    else:
        infos.append(msg)


# ── 1. Detect DB type and DB-related features ──────────────────

def detect_db(feature_list_path):
    """Return (db_type_str, list_of_feature_ids_with_db)."""
    db_str = ""
    db_features = []

    try:
        with open(feature_list_path) as f:
            data = json.load(f)
    except Exception:
        return "", []

    db_str = data.get("global_context", {}).get("database", "")

    if not db_str:
        try:
            with open(".prizmkit/config.json") as f:
                cfg = json.load(f)
            db_str = cfg.get("tech_stack", {}).get("database", "")
        except Exception:
            pass

    if not db_str:
        return "", []

    for feat in data.get("features", []):
        desc = (feat.get("description", "") + " " + feat.get("title", "")).lower()
        if any(k in desc for k in DB_KEYWORDS):
            db_features.append(feat["id"])

    return db_str, db_features


# ── 2. Scan env files for DB connection vars ────────────────────

def scan_env_vars():
    """Return (env_file_used, {var_name: value})."""
    for env_file in ENV_FILES:
        if not os.path.isfile(env_file):
            continue
        found = {}
        with open(env_file) as f:
            content = f.read()
        for _group, pattern in DB_VAR_PATTERNS:
            for m in re.finditer(
                r"^(?!#)("+pattern + r")\s*=\s*(.+)",
                content,
                re.MULTILINE | re.IGNORECASE,
            ):
                var_name = m.group(1)
                var_val = m.group(2).strip().strip('"').strip("'")
                if var_val:
                    found[var_name] = var_val
        if found:
            return env_file, found
    return None, {}


# ── 3. Connectivity checks (per DB type) ───────────────────────

def _curl_code(url, headers=None, timeout=10):
    """Run curl and return HTTP status code string."""
    cmd = ["curl", "-s", "-o", os.devnull, "-w", "%{http_code}",
           "--max-time", str(timeout), url]
    for h in (headers or []):
        cmd += ["-H", h]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 5)
        return r.stdout.strip()
    except Exception:
        return "000"


def _get_var(env_vars, *patterns):
    """Find first env var matching any pattern."""
    for pat in patterns:
        for k, v in env_vars.items():
            if re.match(pat + "$", k, re.IGNORECASE) and v:
                return k, v
    return None, None


def check_connectivity(db_type, env_vars):
    """Test database connectivity. Returns True if connected."""
    dt = db_type.lower()

    # ── Supabase ──
    if "supabase" in dt:
        _, url = _get_var(env_vars, r"(?:NEXT_PUBLIC_)?SUPABASE_URL")
        _, key = _get_var(env_vars, r"(?:NEXT_PUBLIC_)?SUPABASE_ANON_KEY")
        if not key:
            _, key = _get_var(env_vars, r"SUPABASE_SERVICE_ROLE_KEY")
        if not (url and key):
            out("⚠", "Supabase URL or anon key not found — cannot test connectivity")
            return False
        # Find a table from first migration to test against
        test_table = "profiles"
        mig_files = sorted(glob.glob("supabase/migrations/*.sql"))
        if mig_files:
            with open(mig_files[0]) as f:
                for line in f:
                    m = re.search(r"CREATE TABLE\s+(?:public\.)?(\w+)", line, re.I)
                    if m:
                        test_table = m.group(1)
                        break
        code = _curl_code(
            f"{url}/rest/v1/{test_table}?limit=0",
            [f"apikey: {key}", f"Authorization: Bearer {key}"],
        )
        if code == "200":
            out("✓", "Database API reachable (Supabase)")
            return True
        else:
            out("⚠", f"Database API unreachable (Supabase HTTP {code})")
            return False

    # ── PostgreSQL / Neon ──
    if any(k in dt for k in ("postgres", "pg", "neon")):
        _, db_url = _get_var(env_vars, r"DATABASE_URL", r"POSTGRES(QL)?_URL", r"PG_URL")
        if not db_url:
            out("⚠", "No DATABASE_URL found — cannot test PostgreSQL connectivity")
            return False
        try:
            r = subprocess.run(
                ["pg_isready", "-d", db_url],
                capture_output=True, text=True, timeout=10,
            )
            if r.returncode == 0:
                out("✓", "PostgreSQL reachable")
                return True
            out("⚠", f"PostgreSQL unreachable: {r.stderr.strip()}")
            return False
        except FileNotFoundError:
            out("ℹ", "pg_isready not installed — cannot verify PostgreSQL connectivity")
            return False
        except Exception as e:
            out("⚠", f"PostgreSQL connectivity test failed: {e}")
            return False

    # ── MySQL / PlanetScale / MariaDB ──
    if any(k in dt for k in ("mysql", "planetscale", "mariadb")):
        _, db_url = _get_var(env_vars, r"DATABASE_URL", r"MYSQL_(URL|HOST)")
        if not db_url:
            out("⚠", "No DATABASE_URL found — cannot test MySQL connectivity")
            return False
        try:
            hostport = db_url.split("@")[-1].split("/")[0] if "@" in db_url else db_url
            host = hostport.split(":")[0]
            port_args = ["-P", hostport.split(":")[1]] if ":" in hostport else []
            r = subprocess.run(
                ["mysqladmin", "ping", "-h", host] + port_args,
                capture_output=True, text=True, timeout=10,
            )
            if "alive" in r.stdout.lower():
                out("✓", "MySQL reachable")
                return True
            out("⚠", "MySQL unreachable")
            return False
        except FileNotFoundError:
            out("ℹ", "mysqladmin not installed — cannot verify MySQL connectivity")
            return False
        except Exception as e:
            out("⚠", f"MySQL connectivity test failed: {e}")
            return False

    # ── MongoDB ──
    if "mongo" in dt:
        _, db_url = _get_var(env_vars, r"MONGO(DB)?_(URI|URL|CONNECTION)", r"DATABASE_URL")
        if not db_url:
            out("⚠", "No MongoDB URI found — cannot test connectivity")
            return False
        try:
            r = subprocess.run(
                ["mongosh", "--eval", "db.runCommand({ping:1})", db_url, "--quiet"],
                capture_output=True, text=True, timeout=10,
            )
            if r.returncode == 0:
                out("✓", "MongoDB reachable")
                return True
            out("⚠", "MongoDB unreachable")
            return False
        except FileNotFoundError:
            out("ℹ", "mongosh not installed — cannot verify MongoDB connectivity")
            return False
        except Exception as e:
            out("⚠", f"MongoDB connectivity test failed: {e}")
            return False

    # ── Firebase ──
    if "firebase" in dt:
        _, project_id = _get_var(env_vars, r"(NEXT_PUBLIC_)?FIREBASE_PROJECT_ID")
        if not project_id:
            out("⚠", "No Firebase project ID found — cannot test connectivity")
            return False
        code = _curl_code(
            f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents?pageSize=0"
        )
        if code in ("200", "401", "403"):
            out("✓", "Firebase project reachable")
            return True
        out("⚠", f"Firebase unreachable (HTTP {code})")
        return False

    # ── Generic DATABASE_URL fallback ──
    _, db_url = _get_var(env_vars, r"DATABASE_URL")
    if db_url and "://" in db_url:
        proto = db_url.split("://")[0]
        if proto in ("postgres", "postgresql"):
            try:
                r = subprocess.run(
                    ["pg_isready", "-d", db_url],
                    capture_output=True, text=True, timeout=10,
                )
                ok = r.returncode == 0
                out("✓" if ok else "⚠", f"PostgreSQL {'reachable' if ok else 'unreachable'}")
                return ok
            except FileNotFoundError:
                out("ℹ", "pg_isready not installed — cannot verify connectivity")
        elif proto in ("mysql", "mariadb"):
            out("ℹ", "MySQL DATABASE_URL found — install mysqladmin to verify connectivity")
        elif proto in ("mongodb", "mongodb+srv"):
            out("ℹ", "MongoDB DATABASE_URL found — install mongosh to verify connectivity")
        else:
            out("ℹ", f"DATABASE_URL found (protocol: {proto}) — cannot auto-verify")
        return False

    out("ℹ", f"Database type \"{db_type}\" detected but no connection variables found")
    return False


# ── 4. Migration status ────────────────────────────────────────

def check_migrations(db_type, env_vars, connected):
    """Check whether migrations have been applied."""
    dt = db_type.lower()
    checked = False

    # ── Prisma ──
    if os.path.isdir("prisma/migrations") or os.path.isfile("prisma/schema.prisma"):
        checked = True
        try:
            env = os.environ.copy()
            env.update(env_vars)
            r = subprocess.run(
                ["npx", "prisma", "migrate", "status"],
                capture_output=True, text=True, timeout=30, env=env,
            )
            if "not yet been applied" in r.stdout.lower():
                out("⚠", "Prisma: unapplied migrations detected")
                for line in r.stdout.splitlines():
                    if "not yet been applied" in line.lower() or line.strip().startswith("- "):
                        out("⚠", f"  {line.strip()}")
            elif r.returncode == 0:
                out("✓", "Prisma: all migrations applied")
            else:
                snippet = (r.stderr or r.stdout or "").strip()[:200]
                snippet = re.sub(r"://[^\s]+@", "://[REDACTED]@", snippet)
                out("⚠", f"Prisma migrate status failed: {snippet}")
        except FileNotFoundError:
            out("ℹ", "npx not found — cannot check Prisma migration status")
        except Exception as e:
            out("⚠", f"Prisma check failed: {e}")

    # ── Drizzle ──
    if os.path.isdir("drizzle") and glob.glob("drizzle/*.sql"):
        checked = True
        out("ℹ", "Drizzle migrations found — verify with `npx drizzle-kit push` or `npx drizzle-kit migrate`")

    # ── Supabase raw SQL ──
    if os.path.isdir("supabase/migrations") and "supabase" in dt:
        checked = True
        url = env_vars.get("NEXT_PUBLIC_SUPABASE_URL", env_vars.get("SUPABASE_URL", ""))
        key = env_vars.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", env_vars.get("SUPABASE_ANON_KEY", ""))

        if url and key and connected:
            for mig in sorted(glob.glob("supabase/migrations/*.sql")):
                with open(mig) as f:
                    content = f.read()
                bn = os.path.basename(mig)
                for match in re.finditer(
                    r"CREATE TABLE\s+(?:(public|auth|storage)\.)?(\w+)",
                    content, re.I,
                ):
                    schema = (match.group(1) or "public").lower()
                    tbl = match.group(2)
                    if schema != "public":
                        continue  # auth/storage tables not accessible via REST API
                    code = _curl_code(
                        f"{url}/rest/v1/{tbl}?limit=0",
                        [f"apikey: {key}", f"Authorization: Bearer {key}"],
                        timeout=5,
                    )
                    if code == "200":
                        out("✓", f"{bn}: table '{tbl}' exists")
                    else:
                        out("⚠", f"{bn}: table '{tbl}' NOT FOUND — migration may not be applied")
        else:
            n = len(glob.glob("supabase/migrations/*.sql"))
            out("ℹ", f"{n} Supabase migration file(s) found — cannot verify without API connection")

    # ── Knex / Rails / generic ──
    for mig_dir in ("migrations", "db/migrate", "db/migrations"):
        if os.path.isdir(mig_dir) and not checked:
            checked = True
            n = len(os.listdir(mig_dir))
            out("ℹ", f"{n} migration file(s) in {mig_dir}/ — verify manually that all are applied")

    if not checked:
        out("ℹ", "No migration directory detected — skipping migration check")


# ── 5. Dev server ──────────────────────────────────────────────

def check_dev_server(feature_list_path):
    """Check if dev server is running (from browser_interaction URLs)."""
    try:
        with open(feature_list_path) as f:
            data = json.load(f)
    except Exception:
        return
    checked_bases = set()
    for feat in data.get("features", []):
        bi = feat.get("browser_interaction")
        if bi and isinstance(bi, dict) and bi.get("url"):
            m = re.match(r"(https?://[^/]+)", bi["url"])
            if m:
                base = m.group(1)
                if base in checked_bases:
                    continue
                checked_bases.add(base)
                code = _curl_code(base, timeout=5)
                if code in ("200", "302"):
                    out("✓", f"Dev server reachable at {base}")
                else:
                    out("ℹ", f"Dev server not running at {base} (AI sessions can start it)")


# ── Main ────────────────────────────────────────────────────────

def main():
    feature_list = sys.argv[1] if len(sys.argv) > 1 else ".prizmkit/plans/feature-list.json"

    if not os.path.isfile(feature_list):
        print(f"PREFLIGHT ⚠ Feature list not found: {feature_list}")
        sys.exit(2)

    # 1. Detect database
    db_type, db_features = detect_db(feature_list)
    if not db_type:
        print("PREFLIGHT ℹ No database configured in global_context — skipping DB checks")
        check_dev_server(feature_list)
        _print_summary()
        return
    if not db_features:
        print(f"PREFLIGHT ℹ Database: {db_type} (no features reference DB — skipping detailed checks)")
        check_dev_server(feature_list)
        _print_summary()
        return

    print(f"PREFLIGHT ℹ Database: {db_type}")
    print(f"PREFLIGHT ℹ DB-related features: {', '.join(db_features)}")

    # 2. Env vars
    env_file, env_vars = scan_env_vars()
    if not env_file:
        out("⚠", "No env file found (.env.local, .env, etc.) — database connection will likely fail")
    elif not env_vars:
        out("⚠", f"{env_file} exists but no database connection variables detected")
    else:
        for var_name in sorted(env_vars.keys()):
            out("✓", f"{var_name} configured")

    # 3. Connectivity
    connected = check_connectivity(db_type, env_vars)

    # 4. Migrations
    check_migrations(db_type, env_vars, connected)

    # 5. Dev server
    check_dev_server(feature_list)

    _print_summary()


def _print_summary():
    """Print JSON summary to stderr and set exit code."""
    summary = {
        "pass_count": len(passes),
        "warn_count": len(warnings),
        "info_count": len(infos),
        "warnings": warnings,
    }
    print(json.dumps(summary), file=sys.stderr)
    sys.exit(1 if warnings else 0)


if __name__ == "__main__":
    main()
