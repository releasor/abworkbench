import { MonitorX } from 'lucide-react';

export function DesktopOnlyFallback() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black px-6 text-white">
      <div className="max-w-md rounded-[32px] border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl shadow-black">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
          <MonitorX className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-xl font-semibold">请从 Abworkbench 桌面客户端启动</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          此项目已关闭普通浏览器访问入口。请使用 Electron 桌面窗口运行，任务流和本地数据能力只在桌面环境中启用。
        </p>
      </div>
    </div>
  );
}
