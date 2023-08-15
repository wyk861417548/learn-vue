/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute,
  invokeWithErrorHandling
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/*初始化 props、methods、data、computed与watch*/
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props) /*初始化props*/
  if (opts.methods) initMethods(vm, opts.methods) /*初始化方法*/
  if (opts.data) { /*初始化data*/
    initData(vm)
  } else { /*该组件没有data的时候绑定一个空对象*/
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed) /*初始化computed*/
  if (opts.watch && opts.watch !== nativeWatch) { /*初始化watch*/
    initWatch(vm, opts.watch)
  }
}

function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

// 初始化data
function initData (vm: Component) {
  let data = vm.$options.data

  //data可能是函数和对象 vue3认定是函数
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  
  // 类型检查 如果不是对象返回警告
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length

  // 遍历data数据 保证data中的数据 与 props 和 methods 不重复
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) { //检查字符串是否以 $ 或 _ 开头

      // vm.xxx  代理到 vm._data.xxx 方便用户使用
      proxy(vm, `_data`, key)
    }
  }
  // 数据观测
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

// 初始化 computed函数
// 1.初始化computed函数，遍历对象，给每个计算属性创建一个计算属性watcher
// 2.定义computed函数的get,set函数
// 3.创建计算属性控制器（createComputedGetter），并且让当前的计算属性的依赖属性去记录当前的渲染watcher，在watcher中创建计算函数，以及脏值判断逻辑
//（只有当依赖属性改变后，通知渲染watcher重新渲染，才会重新调用watcher.evaluate更新数据）
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]

    // 计算属性可能是一个function，也有可能设置了get以及set的对象。
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      // 每个计算属性 对应一个计算属性watcher  默认lazy：true 调用一次计算属性方法watcher.evaluate 计算值
      // 此刻的计算watcher的get方法 就是当前计算属性的get方法
      watchers[key] = new Watcher(vm,getter || noop,noop,computedWatcherOptions)
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      // 当页面{{}}展示计算属性的时候，get即createComputedGetter方法执行
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      } else if (vm.$options.methods && key in vm.$options.methods) {
        warn(`The computed property "${key}" is already defined as a method.`, vm)
      }
    }
  }
}


/**
 *定义计算属性 简单来说就是这个
  function defineComputed(target,key,userDef){
    const setter = userDef.set || (()=>{})
    Object.defineProperty(target,key,{
      get:createComputedGetter(key),
      set:setter
    })
  }
*/
export function defineComputed (target: any,key: string,userDef: Object | Function) {
  const shouldCache = !isServerRendering()

  // 这块总结：就是对计算属性的get和set做初始化设置
  if (typeof userDef === 'function') {
    /*创建计算属性的getter*/
    sharedPropertyDefinition.get = shouldCache? createComputedGetter(key): createGetterInvoker(userDef)
    /*
      当userDef是一个function的时候是不需要setter的，所以这边给它设置成了空函数。
      因为计算属性默认是一个function，只设置getter。
      当需要设置setter的时候，会将计算属性设置成一个对象。参考：https://v2.cn.vuejs.org/v2/guide/computed.html#计算-setter
    */
    sharedPropertyDefinition.set = noop
  } else {
    /*get不存在则直接给空函数，如果存在则查看是否有缓存cache，没有依旧赋值get，有的话使用createComputedGetter创建*/
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop

    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }

  // 给计算属性设置get set
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 创建一个计算属性控制器 用于控制页面多次调用计算属性只执行一次
// 计算属性根本不会去收集依赖，只会让自己的依赖属性去收集依赖
function createComputedGetter (key) {

  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key] //获取到对应计算属性的watcher
    if (watcher) {
      if (watcher.dirty) {
        // 如果用户数据是脏的就去执行的函数更新数据
        watcher.evaluate()
      } 
      // 依赖收集
      if (Dep.target) {
        console.log('dep-target',Dep.target);
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

// 初始化watch
// 1.遍历watch对象，给每一个监听属性添加一个watch watcher
// 2.判断值是对象还是函数，如果是对象单独处理handler
// 3.将watch遍历的 key 做为传入watcher中，并包裹成函数赋值给getter，该函数执行的结果作为watch的旧值新值

// watch写法
// 1：watch:{name:'fn'}
// 2：watch:{name:()=>{}}
// 3：watch:{name:[()=>{},()=>{}]}
// 4：watch:{name:{handler(){},immediate:true}}
// 5:vm.$watch(()=>vm.name,()=>{})
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
     /*数组则遍历进行createWatcher*/
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // 如果是一个对象 watch:{name:{handler(){},immediate:true}}
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  /*当然，也可以直接使用vm中methods的方法 */
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    
    // 如果回调函数是对象
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }

    options = options || {}
    options.user = true
    // 创建watch watcher
    const watcher = new Watcher(vm, expOrFn, cb, options)
    // 立即执行
    if (options.immediate) {
      const info = `callback for immediate watcher "${watcher.expression}"`
      pushTarget()
      invokeWithErrorHandling(cb, vm, [watcher.value], vm, info)
      popTarget()
    }
    /*返回一个取消观察函数，用来停止触发回调*/
    return function unwatchFn () {
      /*将自身从所有依赖收集订阅列表删除*/
      watcher.teardown()
    }
  }
}
