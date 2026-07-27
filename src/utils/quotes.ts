interface Quote {
  text: string
  author: string
}

const quotes: Quote[] = [
  { text: '千里之行，始于足下。', author: '老子' },
  { text: '学而不思则罔，思而不学则殆。', author: '孔子' },
  { text: '天行健，君子以自强不息。', author: '《周易》' },
  { text: '不积跬步，无以至千里。', author: '荀子' },
  { text: '业精于勤，荒于嬉；行成于思，毁于随。', author: '韩愈' },
  { text: '书山有路勤为径，学海无涯苦作舟。', author: '韩愈' },
  { text: '世上无难事，只怕有心人。', author: '毛泽东' },
  { text: '活到老，学到老。', author: '朱熹' },
  { text: '今日事，今日毕。', author: '文嘉' },
  { text: '失败乃成功之母。', author: '培根' },
  { text: '知之为知之，不知为不知，是知也。', author: '孔子' },
  { text: '温故而知新，可以为师矣。', author: '孔子' },
  { text: '三人行，必有我师焉。', author: '孔子' },
  { text: '己所不欲，勿施于人。', author: '孔子' },
  { text: '生于忧患，死于安乐。', author: '孟子' },
  { text: '富贵不能淫，贫贱不能移，威武不能屈。', author: '孟子' },
  { text: '路漫漫其修远兮，吾将上下而求索。', author: '屈原' },
  { text: '锲而不舍，金石可镂。', author: '荀子' },
  { text: '精诚所至，金石为开。', author: '王充' },
  { text: '宝剑锋从磨砺出，梅花香自苦寒来。', author: '佚名' },
  { text: '吾日三省吾身。', author: '曾子' },
  { text: '知耻近乎勇。', author: '《中庸》' },
  { text: '言必信，行必果。', author: '孔子' },
  { text: '工欲善其事，必先利其器。', author: '孔子' },
  { text: '纸上得来终觉浅，绝知此事要躬行。', author: '陆游' },
  { text: '黑发不知勤学早，白首方悔读书迟。', author: '颜真卿' },
  { text: '少壮不努力，老大徒伤悲。', author: '《长歌行》' },
  { text: '博学之，审问之，慎思之，明辨之，笃行之。', author: '《中庸》' },
  { text: '不飞则已，一飞冲天；不鸣则已，一鸣惊人。', author: '司马迁' },
  { text: '海纳百川，有容乃大；壁立千仞，无欲则刚。', author: '林则徐' },
  { text: '人生在勤，不索何获。', author: '张衡' },
  { text: '志不强者智不达。', author: '墨子' },
  { text: '天下事有难易乎？为之，则难者亦易矣。', author: '彭端淑' },
  { text: '苟日新，日日新，又日新。', author: '《大学》' },
  { text: '天将降大任于斯人也，必先苦其心志。', author: '孟子' },
  { text: '不经一番寒彻骨，怎得梅花扑鼻香。', author: '黄檗禅师' },
  { text: '沉舟侧畔千帆过，病树前头万木春。', author: '刘禹锡' },
  { text: '长风破浪会有时，直挂云帆济沧海。', author: '李白' },
  { text: '会当凌绝顶，一览众山小。', author: '杜甫' },
  { text: '千磨万击还坚劲，任尔东西南北风。', author: '郑燮' },
]

export function getDailyQuote(): Quote {
  const dayNum = Math.floor(Date.now() / 86400000)
  return quotes[dayNum % quotes.length]
}

export function getRandomQuote(exclude?: Quote): Quote {
  if (exclude && quotes.length > 1) {
    let quote: Quote
    do {
      quote = quotes[Math.floor(Math.random() * quotes.length)]
    } while (quote.text === exclude.text)
    return quote
  }
  return quotes[Math.floor(Math.random() * quotes.length)]
}
