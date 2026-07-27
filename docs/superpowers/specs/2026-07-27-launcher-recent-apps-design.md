# Launcher Recent Apps + Style Unify

**Goal:** Alt+Space 首页展示系统最近应用；输入时模糊搜索已安装应用；启动器视觉对齐主程序 glass-card / 命令面板风格。

**Approach:** 扫描 Start Menu / 桌面 `.lnk` + Windows Recent；本机使用频率加权；主进程缓存与 IPC；渲染层列表样式对齐 CommandPalette。

**Out of scope:** UWP 全量枚举、插件市场、全量高清图标缓存。
