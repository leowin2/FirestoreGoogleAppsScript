import { babel } from "@rollup/plugin-babel"; import { nodeResolve } from "@rollup/plugin-node-resolve"; const extensions = [ ".ts", ".js" ]; const preventTreeShakingPlugin = () => {
  return {
    name: "no-treeshaking",
    resolveId(id,
    importer) {
      if (!importer)
      {
        // let's not treeshake entry points, as we're not exporting anything in App Scripts
        return {
          id,
          moduleSideEffects: "no-treeshake"
        }
        ;
      }
      return null;
    },
  }
  ;
}; export default [
  "./src/Auth.ts",
  "./src/Document.ts",
  "./src/Firestore.ts",
  "./src/FirestoreDelete.ts",
  "./src/FirestoreRead.ts",
  "./src/FirestoreWrite.ts",
  "./src/Query.ts",
  "./src/Request.ts",
  "./src/Tests.ts",
  "./src/Util.ts",
  "./src/AggregateQuery.ts",
  "./src/Examples.ts",
  "./src/Transaction.ts",
  "./src/WriteBatch.ts"
].map(input => ( {
  input,
  output: {
    dir: "build",
    format: "cjs",
  },
  external: [ /^@babel\/runtime/ ],
  plugins: [
    preventTreeShakingPlugin(),
    nodeResolve(
    {
      extensions,
      mainFields: [ "jsnext:main", "main" ],
    }
    ),
    babel(
    {
      extensions,
      babelHelpers: "bundled",
      exclude: "node_modules/**"
    }
    ),
  ],
}));
