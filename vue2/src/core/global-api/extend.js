/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   * 每个实例构造函数，包括Vue，都有一个唯一的cid。这使我们能够为原型继承创建封装的“子构造函数”并缓存它们。
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   * 使用基础 Vue 构造器，创建一个“子类”。参数是一个包含组件选项的对象。
   */
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {}
    /*父类的构造*/
    const Super = this
    /*父类的cid*/
    const SuperId = Super.cid
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})

    /*如果构造函数中已经存在了该cid，则代表已经extend过了，直接返回*/
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name)
    }

    const Sub = function VueComponent (options) {
      this._init(options)
    }
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
    Sub.cid = cid++

    // 自己options中components[key](每一个组件)的和全局（Vue.options）的components[key]（每一个组件）建立一个联系（prototype联系）
    // 通过components查找如果自己有使用自己的，如果没有去原型上找找到使用全局的
    Sub.options = mergeOptions(Super.options,extendOptions)

    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    // 对于props和计算属性，我们在扩展时在Vue实例上的扩展原型上定义代理getter。这样可以避免对创建的每个实例调用Object.defineProperty
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
    /*加入extend、mixin以及use方法，允许将来继续为该组件提供扩展、混合或者插件*/
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    /*使得Sub也会拥有父类的私有选项（directives、filters、components）*/
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })


    // enable recursive self-lookup
    /*把组件自身也加入components中，为递归自身提供可能（递归组件也会查找components是否存在当前组件，也就是自身）*/
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    /*保存一个父类的options，此后我们可以用来检测父类的options是否已经被更新*/
    Sub.superOptions = Super.options
    /*extendOptions存储起来*/
    Sub.extendOptions = extendOptions
    /*保存一份option，extend的作用是将Sub.options中的所有属性放入{}中*/
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    /*缓存构造函数（用cid），防止重复extend*/
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
