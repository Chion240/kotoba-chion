const assert = require('node:assert/strict')

const modulePath = process.argv[2]
assert.ok(modulePath, '必须传入发行包中的 better-sqlite3 模块路径')
const Database = require(modulePath)
const db = new Database(':memory:')
try {
  assert.equal(db.prepare('select 42 as answer').get().answer, 42)
} finally {
  db.close()
}

console.log('OK: 发行包 better-sqlite3 已按 Electron ABI 加载并完成内存查询')
