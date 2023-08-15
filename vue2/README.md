##### 代码目录结构
```
├─benchmarks              # 做性能测试
├─dist                    # 项目构建后的文件
├─examples                # 官方例子
├─flow                    # 类型检查（没人用了） 和 ts功能类似
├─script                  # 所有打包的脚本都放在这里
├─src                     # 项目源代码
    ├─complier            # 与模板编译相关的代码
    ├─core                # 通用的、与运行平台无关的运行时代码
      ├─global-api        # 全局api的代码
      ├─instance          # Vue.js实例的构造函数和原型方法
      ├─observe           # 实现变化侦测的代码
      ├─vdom              # 实现virtual dom的代码
      └─components        # 内置组件的代码
    ├─server              # 服务端渲染相关
    ├─sfc                 # 解析单文件组件的
    ├─shared              # 项目公用的工具代码
    ├─platforms           # 平台（针对不同的平台做不同的处理）
      ├─web
        ├─compiler        
        ├─runtime         #打包的入口
        ├─server
          ├─modules
            ├─attrs       #属性处理
            ├─class       #类名处理
            ├─dom-props   #dom属性处理
            ├─events      #事件处理
            ├─styles      #样式处理
            ├─transition
          ├─directives
      ├─weex 

- 通过package.json 找到打包入口
  - scripts/config.js (web-full-dev, web-runtime-cjs-dev,web-runtime-esm....)
  
- 打包的入口
  - src/platforms/web/entry-runtime.js
  - src/platforms/web/entry-runtime-with-compiler.js (两个入口的区别是带有compiler的会重写$mount，将template变成render函数)
  - runtime/index.js (所谓的 运行时会提供一些dom操作的api、属性操作、元素操作、提供一些组件和指令)

- 指定sourcemap参数开启调试
  - scripts/config.js 输出配置中加sourcemap:true
  - 或者 文件package.json中命令中加 --sourcemap

```
