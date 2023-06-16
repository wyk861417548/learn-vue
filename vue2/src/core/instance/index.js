import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  /*初始化*/
  this._init(options)
}

// 扩展 init 方法
initMixin(Vue)
// 扩展 watch 等方法
stateMixin(Vue)
// 扩展 $on $$once 等事件
eventsMixin(Vue)
// 扩展 vm._render vm._update 方法
lifecycleMixin(Vue)
// 扩展 _render
renderMixin(Vue)

export default Vue
