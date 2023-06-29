/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type CacheEntry = {
  name: ?string;
  tag: ?string;
  componentInstance: Component;
};

type CacheEntryMap = { [key: string]: ?CacheEntry };

/* 获取组件名称 */
function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

/* 检测name是否匹配 */
function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') { /* 字符串情况，如a,b,c */
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) { /* 正则 */
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

/* 对cache进行进行遍历，取出每一项的name值，用其与新的缓存规则进行匹配，如果匹配不上，则表示在新的缓存规则下改组件不需要被缓存 */
function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance
  for (const key in cache) {
    /* 取出cache中的vnode */
    const entry: ?CacheEntry = cache[key]
    /* name不符合filter条件的，同时不是目前渲染的vnode时，销毁vnode对应的组件实例（Vue实例），并从cache中移除 */
    if (entry) {
      const name: ?string = entry.name
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

/* 销毁vnode对应的组件实例（Vue实例） */
function pruneCacheEntry (cache: CacheEntryMap,key: string,keys: Array<string>,current?: VNode) {
  const entry: ?CacheEntry = cache[key]
  if (entry && (!current || entry.tag !== current.tag)) {
    entry.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

/** keep-alive组件
 * 为什么要删除第一个缓存组件并且为什么命中缓存了还要调整组件key的顺序？
 * 这其实应用了一个缓存淘汰策略LRU：
 * LRU（Least recently used，最近最少使用）算法根据数据的历史访问记录来进行淘汰数据，其核心思想是“如果数据最近被访问过，那么将来被访问的几率也更高”。
 */
export default {
  name: 'keep-alive',
  abstract: true, // 判断当前组件虚拟dom是否渲染成真是dom的关键

  props: {
    include: patternTypes,  // 缓存白名单
    exclude: patternTypes, // 缓存黑名单
    max: [String, Number] // 缓存的组件实例数量上限
  },

  methods: {
    cacheVNode() {
      const { cache, keys, vnodeToCache, keyToCache } = this
      if (vnodeToCache) {
        const { tag, componentInstance, componentOptions } = vnodeToCache
        cache[keyToCache] = {
          name: getComponentName(componentOptions),
          tag,
          componentInstance,
        }
        keys.push(keyToCache)
        // prune oldest entry
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
        this.vnodeToCache = null
      }
    }
  },

  created () {
    /* 缓存对象 */
    this.cache = Object.create(null)
    this.keys = []
  },

  /* destroyed钩子中销毁所有cache中的组件实例 */
  destroyed () {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted () {
    this.cacheVNode()

    /* 监视include以及exclude，在被修改的时候对cache进行修正 */
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },

  updated () {
    this.cacheVNode()
  },

  render () {
    
    const slot = this.$slots.default
    /* 得到slot插槽中的第一个组件 */
    const vnode: VNode = getFirstComponentChild(slot)

    /* 获取该组件节点的componentOptions */
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions

    
    if (componentOptions) {
      // check pattern /* 获取组件名称，优先获取组件的name字段，否则是组件的tag */
      const name: ?string = getComponentName(componentOptions)
      const { include, exclude } = this

      /* name不在inlcude中或者在exlude中则直接返回vnode（没有取缓存） */
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }

      const { cache, keys } = this
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      
      /* 如果已经做过缓存了则直接从缓存中获取组件实例给vnode，还未缓存过则进行缓存 */
      if (cache[key]) {
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
         /* 调整该组件key的顺序，将其从原来的地方删除并重新放在最后一个 */
        remove(keys, key)
        keys.push(key)
      } else {
        // delay setting the cache until update 延迟设置缓存直到更新
        this.vnodeToCache = vnode
        this.keyToCache = key
      }

      /* keepAlive标记位 */
      vnode.data.keepAlive = true
    }
    return vnode || (slot && slot[0])
  }
}
