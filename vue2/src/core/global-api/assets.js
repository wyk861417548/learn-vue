/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   * 遍历预定义的资源类型数组 ASSET_TYPES，该数组包括了 Vue 支持的资源类型，如 'component'、'directive'、'filter' 等。
   */
  ASSET_TYPES.forEach(type => {
    //  在 Vue 对象上添加对应资源类型的注册方法。这个函数接受两个参数：id 表示资源的唯一标识，definition 表示资源的定义（可以是函数或对象）。
    Vue[type] = function (id: string,definition: Function | Object): Function | Object | void {
      // 如果没有提供 definition，则返回已经注册的该类型资源中的指定 id 的定义。
      if (!definition) {
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }
        //  如果是注册组件且 definition 是一个纯对象
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id
          definition = this.options._base.extend(definition)
        }
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
