export default {
  // 每行最多字符数，超出则换行。100-120 比较适合现代宽屏显示器。
  printWidth: 100,
  // tab 缩进大小，默认为 2
  tabWidth: 2,
  // 使用 tab 缩进，默认为 false
  useTabs: false,
  // 结尾是否添加分号，默认为 true。推荐 false，更简洁。
  semi: false,
  // 使用单引号，默认为 false
  singleQuote: true,
  // 对象、数组等结尾的逗号
  // 'es5' - 在 ES5 中有效的尾随逗号（对象、数组等）
  // 'all' - 尽可能使用尾随逗号（包括函数参数）
  // 'none' - 不使用尾随逗号
  trailingComma: 'es5',
  // 对象大括号内两边是否加空格 { a: 1 }
  bracketSpacing: true,
  // 箭头函数参数是否加括号。'always' - (x) => x, 'avoid' - x => x。
  // 'always' 可以保持一致性，推荐。
  arrowParens: 'always',
  // Vue 文件 <script> 和 <style> 标签是否缩进
  vueIndentScriptAndStyle: true,
  // 文件末尾换行。'lf' 是 Linux 和 macOS 的标准。
  endOfLine: 'lf',
}
