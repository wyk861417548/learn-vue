##### 代码目录结构
```
├── .circleci // CI 配置目录
├── .ls-lint.yml // 文件命名规范
├── .prettierrc // 代码格式化 prettier 的配置文件
├── CHANGELOG.md  // 更新日志
├── LICENSE
├── README.md
├── api-extractor.json // TypeScript 的API提取和分析工具
├── jest.config.js  //  测试框架 jest 的配置文件
├── node_modules
├── package-lock.json
├── package.json
├── rollup.config.js  // 模块打包器 rollup 的配置文件
├── scripts
├── test-dts // TypeScript 声明文件
├── tsconfig.json // TypeScript 配置文件
├── packages // Vue源代码目录
      ├── compiler-core // 顾名思义，核心中的核心，抽象语法树和渲染桥接实现
      ├── compiler-dom // Dom的实现
      ├── compiler-sfc // Vue单文件组件(.vue)的实现
      ├── compiler-ssr
      ├── global.d.ts
      ├── reactivity
      ├── runtime-core
      ├── runtime-dom
      ├── runtime-test
      ├── server-renderer // 服务端渲染实现
      ├── shared  // package 之间共享的工具库
      ├── size-check
      ├── template-explorer
      └── vue

- 通过package.json 找到打包入口

```
