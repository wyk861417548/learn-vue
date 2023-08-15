/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
// 获取新的实例原型  不影响原数组方法
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]

  // 数组方法的重写
  def(arrayMethods, method, function mutator (...args) {
    // 内部还是调用了原来的方法
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted //传参
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':  //arr.splice(0,1,{age:18},{a:1})
        inserted = args.slice(2)
        break
    }
    
    // 对新增的内容再次进行观测
    if (inserted) ob.observeArray(inserted)
    // notify change
    ob.dep.notify()
    return result
  })
})
