/**
 * Windows Settings search catalog — fine-grained ms-settings: pages
 * with CN/EN keywords similar to the built-in Settings search box.
 * URIs verified against local SystemSettings.dll where possible.
 */

export interface WindowsSettingEntry {
  id: string
  name: string
  description: string
  uri: string
  /** Parent category shown like Windows Settings breadcrumbs */
  category: string
  keywords: string[]
}

function s(
  id: string,
  name: string,
  category: string,
  uri: string,
  description: string,
  keywords: string[]
): WindowsSettingEntry {
  return { id, name, category, uri, description, keywords }
}

export const WINDOWS_SETTINGS: WindowsSettingEntry[] = [
  // —— 主页 / 系统 ——
  s('home', '设置主页', '设置', 'ms-settings:home', '打开 Windows 设置', ['设置', 'settings', '系统设置', 'windows settings', '主页']),
  s('system', '系统', '系统', 'ms-settings:system', '显示、声音、通知、电源等', ['系统', 'system']),
  s('display', '显示', '系统', 'ms-settings:display', '分辨率、缩放、亮度、多显示器', ['显示', 'display', '分辨率', 'resolution', '屏幕', '亮度', 'brightness', '缩放', 'scale', 'dpi', '多显示器', '外接显示器']),
  s('nightlight', '夜间模式', '系统 > 显示', 'ms-settings:nightlight', '减少蓝光，护眼', ['夜间模式', 'night light', '蓝光', '护眼', '暖色']),
  s('display-advanced', '缩放与布局', '系统 > 显示', 'ms-settings:display-advanced', '高级缩放设置', ['缩放', 'scaling', '高级显示', 'layout', '文字大小']),
  s('display-hdr', 'HDR', '系统 > 显示', 'ms-settings:display-hdr', '高动态范围显示', ['hdr', '高动态范围']),
  s('graphics', '图形设置', '系统 > 显示', 'ms-settings:display-advancedgraphics', '应用的 GPU 偏好', ['图形', 'graphics', 'gpu', '显卡', '高性能', '节能']),
  s('screenrotation', '显示方向', '系统 > 显示', 'ms-settings:screenrotation', '横屏/竖屏', ['旋转', 'rotation', '方向', '横屏', '竖屏']),
  s('sound', '声音', '系统', 'ms-settings:sound', '输出、输入与音量', ['声音', 'sound', '音量', 'volume', '扬声器', '耳机', 'speaker']),
  s('sound-devices', '管理声音设备', '系统 > 声音', 'ms-settings:sound-devices', '启用或禁用音频设备', ['声音设备', 'sound devices', '音频设备']),
  s('sound-output', '输出设备属性', '系统 > 声音', 'ms-settings:sound-defaultoutputproperties', '默认播放设备属性', ['输出设备', '播放设备', '默认扬声器']),
  s('sound-input', '输入设备属性', '系统 > 声音', 'ms-settings:sound-defaultinputproperties', '默认录音设备属性', ['输入设备', '麦克风属性', '录音']),
  s('apps-volume', '音量混合器', '系统 > 声音', 'ms-settings:apps-volume', '按应用调节音量', ['音量混合器', 'volume mixer', '应用音量', '混音']),
  s('notifications', '通知', '系统', 'ms-settings:notifications', '应用通知与横幅', ['通知', 'notifications', '消息通知', '横幅', 'toast']),
  s('quiethours', '专注助手', '系统', 'ms-settings:quiethours', '勿扰与专注时段', ['专注助手', '勿扰', 'focus assist', 'quiet hours', '免打扰', 'dnd']),
  s('quiet-scheduled', '专注助手 · 定时', '系统 > 专注助手', 'ms-settings:quietmomentsscheduled', '在这些时段开启', ['专注定时', '勿扰时段']),
  s('quiet-game', '专注助手 · 游戏时', '系统 > 专注助手', 'ms-settings:quietmomentsgame', '玩游戏时自动勿扰', ['游戏勿扰']),
  s('quiet-present', '专注助手 · 投影时', '系统 > 专注助手', 'ms-settings:quietmomentspresentation', '复制显示时勿扰', ['投影勿扰', '演示勿扰']),
  s('powersleep', '电源和电池', '系统', 'ms-settings:powersleep', '屏幕关闭、睡眠、电池', ['电源', '电池', '睡眠', 'power', 'battery', 'sleep', '休眠', 'hibernate', '节能']),
  s('batterysaver', '电池保护程序', '系统 > 电源', 'ms-settings:batterysaver', '省电模式', ['省电', 'battery saver', '电池保护']),
  s('battery-usage', '电池使用情况', '系统 > 电源', 'ms-settings:batterysaver-usagedetails', '各应用耗电', ['耗电', '电池使用', 'battery usage']),
  s('energy', '能源建议', '系统', 'ms-settings:energyrecommendations', '节能建议', ['能源', '节能建议', 'energy']),
  s('storage', '存储', '系统', 'ms-settings:storagesense', '磁盘空间与存储感知', ['存储', 'storage', '磁盘', 'disk', '硬盘', '空间不足', '清理磁盘']),
  s('storage-policies', '存储感知', '系统 > 存储', 'ms-settings:storagepolicies', '自动清理临时文件', ['存储感知', 'storage sense', '自动清理', '临时文件']),
  s('storage-recs', '清理建议', '系统 > 存储', 'ms-settings:storagerecommendations', '可清理的内容建议', ['清理建议', '释放空间']),
  s('disks', '磁盘和卷', '系统 > 存储', 'ms-settings:disksandvolumes', '管理磁盘分区', ['磁盘管理', '分区', '卷', 'volumes', '格式化']),
  s('savelocations', '保存位置', '系统 > 存储', 'ms-settings:savelocations', '新内容默认保存位置', ['保存位置', '默认磁盘', '新文件保存到']),
  s('multitasking', '多任务处理', '系统', 'ms-settings:multitasking', '贴靠窗口、虚拟桌面、Alt+Tab', ['多任务', 'multitasking', '贴靠', 'snap', '虚拟桌面', 'desktop', 'alttab', 'alt+tab', '任务视图']),
  s('activation', '激活', '系统', 'ms-settings:activation', 'Windows 激活状态', ['激活', 'activation', '正版', '产品密钥', 'product key']),
  s('troubleshoot', '疑难解答', '系统', 'ms-settings:troubleshoot', '推荐的疑难解答', ['疑难解答', 'troubleshoot', '修复', '故障排除', '诊断']),
  s('recovery', '恢复', '系统', 'ms-settings:recovery', '重置此电脑、高级启动', ['恢复', 'recovery', '重置电脑', 'reset', '重装', '高级启动', '蓝屏修复']),
  s('project', '投影到此电脑', '系统', 'ms-settings:project', '允许其他设备投影', ['投影', 'project', '无线显示', 'miracast']),
  s('remotedesktop', '远程桌面', '系统', 'ms-settings:remotedesktop', '启用远程桌面', ['远程桌面', 'remote desktop', 'rdp', '远程控制']),
  s('clipboard', '剪贴板', '系统', 'ms-settings:clipboard', '剪贴板历史与同步', ['剪贴板', 'clipboard', '复制历史', 'win+v', '剪切板']),
  s('about', '关于', '系统', 'ms-settings:about', '设备规格、重命名电脑、Windows 版本', ['关于', 'about', '本机', '设备名称', '改名', '版本号', 'windows 规格', '系统信息', 'cpu', '内存', 'ram']),
  s('deviceusage', '设备使用情况', '系统', 'ms-settings:deviceusage', '设备用途偏好', ['设备使用', 'device usage']),
  s('systemcomponents', '系统组件', '系统', 'ms-settings:systemcomponents', '系统组件管理', ['系统组件', 'system components']),
  s('presence', '状态感知', '系统', 'ms-settings:presence', '存在感应相关设置', ['状态感知', 'presence', '人体感应']),

  // —— 蓝牙和设备 ——
  s('devices', '蓝牙和设备', '蓝牙和设备', 'ms-settings:devices', '已连接设备总览', ['设备', 'devices', '已连接设备']),
  s('bluetooth', '蓝牙', '蓝牙和设备', 'ms-settings:bluetooth', '配对蓝牙设备', ['蓝牙', 'bluetooth', '配对', '耳机蓝牙', '音箱']),
  s('connecteddevices', '已连接的设备', '蓝牙和设备', 'ms-settings:connecteddevices', '其他无线设备', ['已连接设备', 'connected devices']),
  s('printers', '打印机和扫描仪', '蓝牙和设备', 'ms-settings:printers', '添加打印机或扫描仪', ['打印机', 'printer', '扫描仪', 'scanner', '打印', '加打印机']),
  s('mobile-devices', '手机连接', '蓝牙和设备', 'ms-settings:mobile-devices', '连接 Android / iPhone', ['手机', '你的手机', 'phone link', 'mobile', '安卓手机', 'iphone']),
  s('camera', '相机', '蓝牙和设备', 'ms-settings:camera', '摄像头设置', ['相机', 'camera', '摄像头', 'webcam']),
  s('mouse', '鼠标', '蓝牙和设备', 'ms-settings:mousetouchpad', '鼠标主键、指针速度', ['鼠标', 'mouse', '指针速度', '滚轮']),
  s('touchpad', '触摸板', '蓝牙和设备', 'ms-settings:devices-touchpad', '触控板手势', ['触摸板', '触控板', 'touchpad', '触控板手势']),
  s('touch', '触摸', '蓝牙和设备', 'ms-settings:devices-touch', '触摸屏相关', ['触摸', 'touch', '触摸屏']),
  s('pen', '笔和 Windows Ink', '蓝牙和设备', 'ms-settings:pen', '手写笔设置', ['手写笔', 'pen', 'windows ink', '触控笔']),
  s('autoplay', '自动播放', '蓝牙和设备', 'ms-settings:autoplay', '插入媒体时的默认操作', ['自动播放', 'autoplay', 'U盘弹出', '插入行为']),
  s('usb', 'USB', '蓝牙和设备', 'ms-settings:usb', 'USB 相关通知', ['usb', '优盘', 'u盘']),
  s('wheel', '轮盘设备', '蓝牙和设备', 'ms-settings:wheel', 'Surface Dial 等', ['wheel', 'surface dial']),

  // —— 网络和 Internet ——
  s('network', '网络和 Internet', '网络和 Internet', 'ms-settings:network', '网络状态总览', ['网络', 'network', 'internet', '上网', '连网']),
  s('network-status', '网络状态', '网络和 Internet', 'ms-settings:network-status', '当前连接状态', ['网络状态', 'status', '连接状态']),
  s('wifi', 'WLAN', '网络和 Internet', 'ms-settings:network-wifi', '无线网络', ['wifi', 'wi-fi', 'wlan', '无线', '无线网', '热点列表']),
  s('wifi-settings', '管理已知网络', '网络和 Internet > WLAN', 'ms-settings:network-wifisettings', '已保存的 WLAN', ['已知网络', '忘记网络', 'wifi 设置']),
  s('ethernet', '以太网', '网络和 Internet', 'ms-settings:network-ethernet', '有线网络', ['以太网', 'ethernet', '有线', '网线']),
  s('cellular', '蜂窝网络', '网络和 Internet', 'ms-settings:network-cellular', '移动数据 / SIM', ['蜂窝', 'cellular', '移动数据', 'sim', '4g', '5g']),
  s('vpn', 'VPN', '网络和 Internet', 'ms-settings:network-vpn', '虚拟专用网络', ['vpn', '虚拟专用网络', '公司vpn']),
  s('hotspot', '移动热点', '网络和 Internet', 'ms-settings:network-mobilehotspot', '将连接共享为热点', ['热点', 'mobile hotspot', '共享网络', '开热点']),
  s('airplane', '飞行模式', '网络和 Internet', 'ms-settings:network-airplanemode', '关闭无线通讯', ['飞行模式', 'airplane', '航班模式']),
  s('proxy', '代理', '网络和 Internet', 'ms-settings:network-proxy', '代理服务器', ['代理', 'proxy', '代理服务器']),
  s('dialup', '拨号', '网络和 Internet', 'ms-settings:network-dialup', '拨号连接', ['拨号', 'dial-up']),
  s('network-advanced', '高级网络设置', '网络和 Internet', 'ms-settings:network-advancedsettings', '适配器选项、数据使用量', ['高级网络', '适配器', 'network adapter', '网卡']),
  s('network-sharing', '高级共享设置', '网络和 Internet', 'ms-settings:network-advancedsharing', '网络发现与文件共享', ['共享', '网络发现', 'file sharing']),
  s('datausage', '数据使用量', '网络和 Internet', 'ms-settings:datausage', '查看流量使用', ['流量', 'data usage', '数据使用量']),

  // —— 个性化 ——
  s('personalization', '个性化', '个性化', 'ms-settings:personalization', '背景、颜色、主题', ['个性化', 'personalization', '外观']),
  s('background', '背景', '个性化', 'ms-settings:personalization-background', '桌面壁纸', ['背景', '壁纸', 'wallpaper', 'background', '桌面背景', '换壁纸']),
  s('colors', '颜色', '个性化', 'ms-settings:colors', '强调色、浅色/深色模式', ['颜色', 'colors', '主题色', '深色模式', '浅色模式', 'dark mode', 'light mode', '强调色', 'accent']),
  s('personalization-colors', '颜色（个性化）', '个性化', 'ms-settings:personalization-colors', '个性化颜色选项', ['个性化颜色']),
  s('themes', '主题', '个性化', 'ms-settings:themes', '主题包与声音方案', ['主题', 'themes', '主题包']),
  s('lockscreen', '锁定屏幕', '个性化', 'ms-settings:lockscreen', '锁屏背景与状态', ['锁屏', 'lock screen', '锁定屏幕', '锁屏壁纸']),
  s('start', '开始', '个性化', 'ms-settings:personalization-start', '开始菜单布局', ['开始菜单', 'start menu', '开始']),
  s('start-places', '开始 · 文件夹', '个性化 > 开始', 'ms-settings:personalization-start-places', '开始菜单旁文件夹', ['开始文件夹']),
  s('taskbar', '任务栏', '个性化', 'ms-settings:taskbar', '任务栏行为与图标', ['任务栏', 'taskbar', '任务栏对齐', '隐藏任务栏', '系统托盘', '角落图标']),
  s('fonts', '字体', '个性化', 'ms-settings:fonts', '安装与预览字体', ['字体', 'fonts', '安装字体', '字库']),
  s('textinput', '触摸键盘个性化', '个性化', 'ms-settings:personalization-textinput', '触摸键盘主题', ['触摸键盘', '输入面板']),
  s('lighting', '动态光效', '个性化', 'ms-settings:personalization-lighting', 'RGB 光效', ['光效', 'lighting', 'rgb']),

  // —— 应用 ——
  s('apps', '应用', '应用', 'ms-settings:appsfeatures', '已安装的应用', ['应用', 'apps', '程序', '软件列表', '卸载', 'uninstall']),
  s('installed-apps', '已安装的应用', '应用', 'ms-settings:installed-apps', '管理已安装应用', ['已安装应用', 'installed apps', '卸载软件']),
  s('advanced-apps', '高级应用设置', '应用', 'ms-settings:advanced-apps', '应用高级选项', ['高级应用']),
  s('defaultapps', '默认应用', '应用', 'ms-settings:defaultapps', '按文件类型/协议选择默认应用', ['默认应用', 'default apps', '打开方式', '默认浏览器', '关联文件']),
  s('default-browser', '默认浏览器', '应用 > 默认应用', 'ms-settings:defaultbrowsersettings', '设置默认浏览器', ['默认浏览器', 'default browser', 'chrome 默认', 'edge 默认']),
  s('optionalfeatures', '可选功能', '应用', 'ms-settings:optionalfeatures', 'Windows 可选功能', ['可选功能', 'optional features', '功能按需', 'dotnet', 'wsl 功能']),
  s('appsforwebsites', '网站应用', '应用', 'ms-settings:appsforwebsites', '链接用哪个应用打开', ['网站应用', 'apps for websites']),
  s('videoplayback', '视频播放', '应用', 'ms-settings:videoplayback', '视频增强与 HDR', ['视频播放', 'video playback']),
  s('startup', '启动应用', '应用', 'ms-settings:startupapps', '开机自动启动', ['启动项', 'startup', '开机启动', '自启动']),
  s('offline-maps', '离线地图', '应用', 'ms-settings:maps', '离线地图', ['离线地图', 'maps']),
  s('download-maps', '下载地图', '应用 > 离线地图', 'ms-settings:maps-downloadmaps', '下载离线地图包', ['下载地图']),

  // —— 账户 ——
  s('accounts', '账户', '账户', 'ms-settings:accounts', '账户与登录', ['账户', '账号', 'accounts', '微软账户', 'microsoft account']),
  s('yourinfo', '你的信息', '账户', 'ms-settings:yourinfo', '头像与账户信息', ['你的信息', '头像', '账户信息']),
  s('emailandaccounts', '电子邮件和账户', '账户', 'ms-settings:emailandaccounts', '邮箱与应用账户', ['邮箱账户', 'email accounts']),
  s('signin', '登录选项', '账户', 'ms-settings:signinoptions', 'PIN、密码、Hello', ['登录选项', 'sign-in', 'pin', '密码', 'windows hello', '人脸', '指纹', '锁屏密码']),
  s('hello-face', 'Windows Hello 人脸', '账户 > 登录选项', 'ms-settings:signinoptions-launchfaceenrollment', '设置人脸识别', ['人脸识别', 'face', '刷脸登录']),
  s('hello-finger', 'Windows Hello 指纹', '账户 > 登录选项', 'ms-settings:signinoptions-launchfingerprintenrollment', '设置指纹', ['指纹', 'fingerprint', '指纹登录']),
  s('pin-enroll', '设置 PIN', '账户 > 登录选项', 'ms-settings:signinoptions-launchpinenrollment', '创建或更改 PIN', ['设置pin', '改pin', 'pin码']),
  s('dynamiclock', '动态锁定', '账户 > 登录选项', 'ms-settings:signinoptions-dynamiclock', '离开时自动锁定', ['动态锁定', 'dynamic lock']),
  s('otherusers', '家庭和其他用户', '账户', 'ms-settings:otherusers', '添加本地/家庭用户', ['其他用户', '添加用户', '家庭组', '多用户']),
  s('family', '家庭组', '账户', 'ms-settings:family-group', '家庭安全与成员', ['家庭', 'family', '儿童账户']),
  s('backup', 'Windows 备份', '账户', 'ms-settings:backup', '备份设置与文件', ['备份', 'backup', '同步设置']),
  s('sync', '同步设置', '账户', 'ms-settings:sync', '漫游同步', ['同步', 'sync']),
  s('workplace', '访问工作或学校', '账户', 'ms-settings:workplace', '组织账户', ['工作或学校', 'workplace', '公司账户', 'aad']),
  s('passkeys', '通行密钥', '账户', 'ms-settings:savedpasskeys', '已保存的通行密钥', ['通行密钥', 'passkey', '密钥']),

  // —— 时间和语言 ——
  s('datetime', '日期和时间', '时间和语言', 'ms-settings:dateandtime', '时区、自动时间', ['时间', '日期', '时区', 'time', 'date', 'timezone', '时钟', '对时']),
  s('language', '语言和区域', '时间和语言', 'ms-settings:regionlanguage', '显示语言、区域格式', ['语言', 'language', '区域', 'region', '显示语言', '中文', '英文']),
  s('language-options', '语言选项', '时间和语言', 'ms-settings:regionlanguage-languageoptions', '语言包与功能', ['语言选项', '语言包']),
  s('pinyin', '微软拼音', '时间和语言', 'ms-settings:regionlanguage-chsime-pinyin', '拼音输入法设置', ['拼音', '输入法', '微软拼音', 'ime', '中文输入']),
  s('wubi', '微软五笔', '时间和语言', 'ms-settings:regionlanguage-chsime-wubi', '五笔输入法', ['五笔', 'wubi']),
  s('regionformatting', '区域格式', '时间和语言', 'ms-settings:regionformatting', '日期数字格式', ['区域格式', '日期格式', '数字格式']),
  s('typing', '键入', '时间和语言', 'ms-settings:typing', '拼写检查、文本建议', ['键入', 'typing', '拼写检查', '输入建议', '自动更正']),
  s('keyboard', '键盘', '时间和语言', 'ms-settings:keyboard', '键盘布局', ['键盘', 'keyboard', '键盘布局']),
  s('keyboard-advanced', '高级键盘设置', '时间和语言', 'ms-settings:keyboard-advanced', '输入语言热键等', ['高级键盘', '切换输入法快捷键']),
  s('speech', '语音', '时间和语言', 'ms-settings:speech', '语音识别与语音包', ['语音', 'speech', '语音识别', '朗读']),

  // —— 游戏 ——
  s('gamebar', 'Xbox Game Bar', '游戏', 'ms-settings:gaming-gamebar', '游戏栏快捷键与小组件', ['game bar', '游戏栏', 'xbox', 'win+g']),
  s('gamedvr', '截图和录制', '游戏', 'ms-settings:gaming-gamedvr', '游戏截图与背景录制', ['游戏录制', '截图', 'game dvr', '录屏']),
  s('gamemode', '游戏模式', '游戏', 'ms-settings:gaming-gamemode', '优化游戏性能', ['游戏模式', 'game mode']),
  s('gaming-fs', '游戏全屏优化', '游戏', 'ms-settings:gaming-fullscreen', '全屏优化相关', ['全屏优化']),

  // —— 辅助功能 ——
  s('ease', '辅助功能', '辅助功能', 'ms-settings:easeofaccess', '视觉、听力和交互', ['辅助功能', 'accessibility', '无障碍', 'ease of access']),
  s('textsize', '文本大小', '辅助功能', 'ms-settings:easeofaccess-display', '放大系统文字', ['文字大小', '文本大小', 'text size', '放大文字']),
  s('visualeffects', '视觉效果', '辅助功能', 'ms-settings:easeofaccess-visualeffects', '动画、透明效果', ['视觉效果', '透明度', '动画']),
  s('mousepointer', '鼠标指针和触摸', '辅助功能', 'ms-settings:easeofaccess-mousepointer', '指针大小与颜色', ['鼠标指针', '指针大小', '指针颜色']),
  s('cursor', '文本光标', '辅助功能', 'ms-settings:easeofaccess-cursor', '光标加粗与指示器', ['光标', '文本光标', 'cursor']),
  s('magnifier', '放大镜', '辅助功能', 'ms-settings:easeofaccess-magnifier', '屏幕放大', ['放大镜', 'magnifier', '放大屏幕']),
  s('colorfilter', '颜色滤镜', '辅助功能', 'ms-settings:easeofaccess-colorfilter', '色盲模式等', ['颜色滤镜', '色盲', 'color filter']),
  s('highcontrast', '对比度主题', '辅助功能', 'ms-settings:easeofaccess-highcontrast', '高对比度', ['高对比度', 'high contrast', '对比度主题']),
  s('narrator', '讲述人', '辅助功能', 'ms-settings:easeofaccess-narrator', '屏幕朗读', ['讲述人', 'narrator', '屏幕朗读']),
  s('ease-audio', '音频（辅助）', '辅助功能', 'ms-settings:easeofaccess-audio', '听力辅助音频选项', ['听力', '单声道', '音频辅助']),
  s('captions', '字幕', '辅助功能', 'ms-settings:easeofaccess-closedcaptioning', '字幕样式', ['字幕', 'captions', 'closed captions']),
  s('ease-speech', '语音（辅助）', '辅助功能', 'ms-settings:easeofaccess-speechrecognition', '语音访问', ['语音访问', 'voice access']),
  s('ease-keyboard', '键盘（辅助）', '辅助功能', 'ms-settings:easeofaccess-keyboard', '粘滞键、筛选键', ['粘滞键', '筛选键', 'sticky keys']),
  s('ease-mouse', '鼠标（辅助）', '辅助功能', 'ms-settings:easeofaccess-mouse', '鼠标键等', ['鼠标键', 'mouse keys']),
  s('eyecontrol', '眼球控制', '辅助功能', 'ms-settings:easeofaccess-eyecontrol', '视线控制', ['眼球控制', 'eye control']),

  // —— 隐私和安全性 ——
  s('privacy', '隐私和安全性', '隐私和安全性', 'ms-settings:privacy', '权限与安全总览', ['隐私', 'privacy', '安全性', 'security', '权限']),
  s('windowsdefender', 'Windows 安全中心', '隐私和安全性', 'ms-settings:windowsdefender', '病毒和威胁防护', ['安全中心', 'defender', '杀毒', '病毒防护', '防火墙', 'windows security']),
  s('findmydevice', '查找我的设备', '隐私和安全性', 'ms-settings:findmydevice', '设备定位', ['查找设备', 'find my device']),
  s('deviceencryption', '设备加密', '隐私和安全性', 'ms-settings:deviceencryption', 'BitLocker / 设备加密', ['加密', 'bitlocker', 'device encryption']),
  s('developers', '开发人员选项', '隐私和安全性', 'ms-settings:developers', '开发人员模式、终端', ['开发人员', 'developer mode', '开发者模式', '开发者选项']),
  s('privacy-general', '常规隐私', '隐私和安全性', 'ms-settings:privacy-general', '广告 ID、启动跟踪等', ['广告标识符', '隐私常规']),
  s('privacy-speech', '语音隐私', '隐私和安全性', 'ms-settings:privacy-speech', '在线语音识别', ['语音隐私']),
  s('privacy-feedback', '诊断和反馈', '隐私和安全性', 'ms-settings:privacy-feedback', '诊断数据级别', ['诊断', '反馈', 'telemetry', '遥测']),
  s('privacy-activity', '活动历史记录', '隐私和安全性', 'ms-settings:privacy-activityhistory', '时间线活动', ['活动历史', '时间线', 'timeline']),
  s('privacy-location', '位置', '隐私和安全性', 'ms-settings:privacy-location', '位置权限', ['位置', '定位', 'location', 'gps']),
  s('privacy-webcam', '相机权限', '隐私和安全性', 'ms-settings:privacy-webcam', '哪些应用可使用相机', ['相机权限', '摄像头权限', 'webcam privacy']),
  s('privacy-mic', '麦克风权限', '隐私和安全性', 'ms-settings:privacy-microphone', '哪些应用可使用麦克风', ['麦克风权限', 'microphone privacy', '麦克风隐私']),
  s('privacy-notifications', '通知权限', '隐私和安全性', 'ms-settings:privacy-notifications', '应用通知权限', ['通知权限']),
  s('privacy-contacts', '通讯录', '隐私和安全性', 'ms-settings:privacy-contacts', '联系人权限', ['通讯录', 'contacts']),
  s('privacy-calendar', '日历', '隐私和安全性', 'ms-settings:privacy-calendar', '日历权限', ['日历权限', 'calendar']),
  s('privacy-email', '电子邮件权限', '隐私和安全性', 'ms-settings:privacy-email', '邮件权限', ['邮件权限']),
  s('privacy-callhistory', '通话记录', '隐私和安全性', 'ms-settings:privacy-callhistory', '通话记录权限', ['通话记录']),
  s('privacy-messaging', '消息传递', '隐私和安全性', 'ms-settings:privacy-messaging', '短信等权限', ['消息权限', 'messaging']),
  s('privacy-radios', '无线电', '隐私和安全性', 'ms-settings:privacy-radios', '控制无线电权限', ['无线电权限']),
  s('privacy-docs', '文档权限', '隐私和安全性', 'ms-settings:privacy-documents', '文档库访问', ['文档权限']),
  s('privacy-pictures', '图片权限', '隐私和安全性', 'ms-settings:privacy-pictures', '图片库访问', ['图片权限']),
  s('privacy-videos', '视频权限', '隐私和安全性', 'ms-settings:privacy-videos', '视频库访问', ['视频权限']),
  s('privacy-downloads', '下载文件夹权限', '隐私和安全性', 'ms-settings:privacy-downloadsfolder', '下载文件夹访问', ['下载权限']),
  s('privacy-fs', '文件系统权限', '隐私和安全性', 'ms-settings:privacy-broadfilesystemaccess', '宽泛文件系统访问', ['文件系统权限', '文件访问']),
  s('privacy-bgapps', '后台应用', '隐私和安全性', 'ms-settings:privacy-backgroundapps', '允许后台运行', ['后台应用', 'background apps']),
  s('privacy-appdiag', '应用诊断', '隐私和安全性', 'ms-settings:privacy-appdiagnostics', '诊断信息权限', ['应用诊断']),
  s('search-permissions', '搜索权限', '隐私和安全性', 'ms-settings:search-permissions', '云内容搜索等', ['搜索权限', 'search permissions']),
  s('windows-search', '搜索 Windows', '隐私和安全性', 'ms-settings:cortana-windowssearch', '索引与搜索 Windows', ['windows 搜索', '搜索索引', 'indexing', '搜索我的文件']),
  s('search', '搜索', '隐私和安全性', 'ms-settings:search', '搜索设置', ['搜索设置', 'search settings']),

  // —— Windows 更新 ——
  s('update', 'Windows 更新', 'Windows 更新', 'ms-settings:windowsupdate', '检查并安装更新', ['更新', 'update', 'windows update', '检查更新', '打补丁']),
  s('update-action', '检查更新', 'Windows 更新', 'ms-settings:windowsupdate-action', '立即检查更新', ['检查更新', 'check for updates']),
  s('update-history', '更新历史记录', 'Windows 更新', 'ms-settings:windowsupdate-history', '已安装的更新', ['更新历史', 'update history']),
  s('update-options', '高级选项', 'Windows 更新', 'ms-settings:windowsupdate-options', '更新高级选项', ['更新高级选项', '活动时间']),
  s('update-optional', '可选更新', 'Windows 更新', 'ms-settings:windowsupdate-optionalupdates', '可选质量/驱动更新', ['可选更新', 'optional updates', '驱动更新']),
  s('update-restart', '重启选项', 'Windows 更新', 'ms-settings:windowsupdate-restartoptions', '更新重启安排', ['更新重启']),
  s('update-uninstall', '卸载更新', 'Windows 更新', 'ms-settings:windowsupdate-uninstallupdates', '卸载已安装更新', ['卸载更新']),
  s('insider', 'Windows Insider 计划', 'Windows 更新', 'ms-settings:windowsinsider', '预览体验计划', ['insider', '预览体验', '内测']),

  // —— 其他 ——
  s('delivery-opt', '传递优化', 'Windows 更新', 'ms-settings:delivery-optimization', '从其他电脑下载更新', ['传递优化', 'delivery optimization']),
  s('ai-components', 'AI 组件', '系统', 'ms-settings:aicomponents', 'AI 相关组件', ['ai', '人工智能组件']),
]

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '').replace(/[·・]/g, '')
}

function fuzzyScore(haystack: string, needle: string): number {
  const n = haystack.toLowerCase()
  const q = needle.toLowerCase().trim()
  if (!q) return 0
  if (n === q) return 1000
  if (n.startsWith(q)) return 860
  if (n.includes(q)) return 720

  const nn = normalize(haystack)
  const qq = normalize(needle)
  if (nn === qq) return 980
  if (nn.startsWith(qq)) return 840
  if (nn.includes(qq)) return 700

  // subsequence
  let qi = 0
  for (let i = 0; i < n.length && qi < q.length; i++) {
    if (n[i] === q[qi]) qi++
  }
  if (qi === q.length && q.length >= 2) return 320 + Math.max(0, 60 - (n.length - q.length))

  const tokens = n.split(/[\s\-_/|()（）、,，]+/).filter(Boolean)
  if (tokens.some((token) => token.startsWith(q) || normalize(token).startsWith(qq))) return 560
  return 0
}

/** Split query into tokens for multi-keyword search like Windows Settings. */
function queryTokens(query: string): string[] {
  const raw = query.trim()
  if (!raw) return []
  const parts = raw
    .split(/[\s|/、,，+]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  // Also add the full query and compact form for Chinese phrases
  const set = new Set<string>(parts)
  set.add(raw)
  if (parts.length > 1) set.add(parts.join(''))
  return Array.from(set)
}

const SETTINGS_PREFIX = /^(?:设置|系統設置|系统设置|windows\s*设置|settings|ms-settings)[:：\s]*(.*)$/i

function scoreEntry(entry: WindowsSettingEntry, tokens: string[]): number {
  let best = 0
  const fields = [
    { text: entry.name, weight: 1 },
    { text: entry.category, weight: 0.55 },
    { text: entry.description, weight: 0.7 },
    { text: entry.uri.replace(/^ms-settings:/i, ''), weight: 0.45 },
    ...entry.keywords.map((kw) => ({ text: kw, weight: 0.95 })),
  ]

  for (const token of tokens) {
    let tokenBest = 0
    for (const field of fields) {
      tokenBest = Math.max(tokenBest, fuzzyScore(field.text, token) * field.weight)
    }
    best += tokenBest
  }

  // Bonus when all tokens hit something
  if (tokens.length > 1) {
    const hits = tokens.filter((token) =>
      fields.some((field) => fuzzyScore(field.text, token) >= 300)
    ).length
    if (hits === tokens.length) best += 120
    else best += hits * 25
  }

  return best
}

export function searchWindowsSettings(query: string, limit = 12): WindowsSettingEntry[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const prefixMatch = trimmed.match(SETTINGS_PREFIX)
  const core = (prefixMatch ? prefixMatch[1] : trimmed).trim()
  const browseAll = !core || core === '设置' || /^settings$/i.test(core)

  if (browseAll) {
    // Like opening Settings search empty / typing "设置"：给常用入口
    const featured = [
      'home', 'display', 'sound', 'wifi', 'bluetooth', 'update',
      'apps', 'personalization', 'privacy', 'powersleep', 'notifications', 'about',
    ]
    return featured
      .map((id) => WINDOWS_SETTINGS.find((e) => e.id === id))
      .filter((e): e is WindowsSettingEntry => Boolean(e))
      .slice(0, limit)
  }

  const tokens = queryTokens(core)
  const scored = WINDOWS_SETTINGS
    .map((entry) => {
      let score = scoreEntry(entry, tokens)
      if (prefixMatch) score += 60
      return { entry, score }
    })
    .filter((row) => row.score >= 280)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, 'zh'))
    .slice(0, limit)

  return scored.map((row) => row.entry)
}
