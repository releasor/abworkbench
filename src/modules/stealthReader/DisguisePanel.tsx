export default function DisguisePanel() {
  return (
    <div
      className="flex h-full flex-col bg-[#f3f3f3] text-[#1f1f1f]"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="border-b border-[#d0d0d0] bg-[#ececec] px-3 py-2 text-xs font-medium">
        周报草稿 - 未命名.xlsx
      </div>
      <div
        className="flex-1 overflow-auto p-4 font-mono text-[12px] leading-6"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="mb-3 text-[#666]">A1: 本周完成事项</div>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-[#e8e8e8]">
              <th className="border border-[#ccc] px-2 py-1">项目</th>
              <th className="border border-[#ccc] px-2 py-1">进度</th>
              <th className="border border-[#ccc] px-2 py-1">备注</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-[#ccc] px-2 py-1">接口联调</td>
              <td className="border border-[#ccc] px-2 py-1">80%</td>
              <td className="border border-[#ccc] px-2 py-1">待补文档</td>
            </tr>
            <tr>
              <td className="border border-[#ccc] px-2 py-1">性能排查</td>
              <td className="border border-[#ccc] px-2 py-1">60%</td>
              <td className="border border-[#ccc] px-2 py-1">继续观察</td>
            </tr>
            <tr>
              <td className="border border-[#ccc] px-2 py-1">周会纪要</td>
              <td className="border border-[#ccc] px-2 py-1">100%</td>
              <td className="border border-[#ccc] px-2 py-1">已同步</td>
            </tr>
          </tbody>
        </table>
        <pre className="mt-4 rounded border border-[#ddd] bg-white p-3 text-[#333]">
{`function summarize(rows) {
  return rows
    .filter((r) => r.progress < 1)
    .map((r) => r.name)
    .join(', ')
}`}
        </pre>
        <p className="mt-3 text-[11px] text-[#888]">按老板键切回阅读 · Esc 隐藏窗口</p>
      </div>
    </div>
  )
}
