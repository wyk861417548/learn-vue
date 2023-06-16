/* @flow */

// 即使用观察者模式
// 1.我们可以给模板中的属性 增加一个收集器 dep
// 2.页面渲染的时候，我们将渲染逻辑封装在watcher中  vm._update(vm._render())
// 3.让dep记住这个watcher即可，稍后属性变化了可以找到对应的dep中存放的watcher进行重新渲染

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  invokeWithErrorHandling,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this
    }
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep // 是否开启对象深层次监听
      this.user = !!options.user //标识是组件自己的watcher（即watch的watcher）
      this.lazy = !!options.lazy //用于标识自己来源是computed方法
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb //watch的回调
    this.id = ++uid // uid for batching 唯一标识
    this.active = true
    //脏值判断（用于判断computed方法是否缓存，是直接把watcher的value返回，否则再次调用evaluate计算新值）
    this.dirty = this.lazy // for lazy watchers
    this.deps = [] // 视图所对应属性对应的dep集合
    this.newDeps = []
    this.depIds = new Set() // 视图对应的dep的id集合
    this.newDepIds = new Set()


    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter

    // expOrFn 视图初始化以及更新函数,computed计算函数，watch回调函数 其中一种
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }

    // this.value 存储第一次执行的值 作为watch的oldVal
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   * 
   * getter 可以是一下几种
   * 1.渲染watcher 渲染函数  vm._update(vm._render());
   * 2.computed watcher computed对象的每个的计算属性的getter
   * 3.watch watcher watch对象中每个监听对象函数
   * 
   * getter每次执行 会将当前的watcher推入栈中，同时也会触发相关属性的getter方法，进行依赖收集
   */
  get () {
    /*将自身watcher观察者实例设置给Dep.target，用以依赖收集。*/
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      /**
       * watch 为什么监听不了对象里面属性的变化
       *    因为只对监听的目标添加了watch watcher 并没有对其属性添加
       * 
       * 开启深度监听
       */
      if (this.deep) {
        traverse(value)
      }
      /*将观察者实例从target栈中取出并设置给Dep.target*/
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   * 当前watcher 添加 dep ，当前的dep 再记录当前的watcher
   */
  addDep (dep: Dep) {
    const id = dep.id

    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   * 清理依赖项集合
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   * 调度者接口，当依赖发生改变的时候进行回调。
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) { /*同步则执行run直接渲染视图*/
      this.run()
    } else {
      /*异步推送到观察者队列中，下一个tick时调用。*/
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   * 真正的视图更新操作
   * 当前watcher
   *    渲染watcher：get执行的是渲染更新方法
   *    计算watcher：get执行计算方法
   *    watch watcher：执行watch回调
   */
  run () {
    if (this.active) {
      // value 主要用于 watch 的回调函数的性子，其他watcher需要 只要get执行就好
      const value = this.get()
      console.log('--------run----------',value === this.value,value,this.value,this.deep,this);

      /**
       * Deep watchers and watchers on Object/Arrays should fire even
       * when the value is the same, because the value may
       * have mutated.
       * 
       * 在观察对象的时候（拥有Deep属性），即便值相同，它其实也可能被更改过了，应该触发更新
       */
      if (
        value !== this.value ||
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          const info = `callback for watcher "${this.expression}"`
          invokeWithErrorHandling(this.cb, this.vm, [value, oldValue], this.vm, info)
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   * 计算属性通过计算watcher获取对应的值
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   * 计算watcher使用 当前watcher所关联的deps 接着记录新的watcher
   * 比如：定义了计算属性，且当前计算属性在页面显示中
   *    1.首先触发计算属性的初始化，创建了一个对应的 “计算watcher”（注意：此时并没有记录）
   *    2.然后就是挂载流程，此刻targetStack存入了 “渲染watcher”
   *    3.在页面挂载流程中 {{计算属性}}，显示会触发计算属性的getter（即watcher.evaluate会默认执行一次），同时计算属性的依赖属性触发getter因此记录当前的“计算watcher” （此刻“计算watcher”入栈和出栈）
   *    4.接着在执行 watcher.depend() 即下方方法，让当前 “计算watcher”所关联的所有属性再去依赖收集 当前的 “渲染watcher”
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   * 将自身从所有依赖收集订阅列表删除
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
