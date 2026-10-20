import type { Plugin } from "vite";

// Manifold 3.0.1's generated Embind glue builds two kinds of invoker with the
// Function constructor. Keep the same wire ABI, using closures instead. This
// implements the non-JIT behaviour described by Emscripten DYNAMIC_EXECUTION=0;
// the bundled WASM kernel, exported API and desktop CSP remain unchanged.
const invoker = `function craftInvokerFunction(humanName,argTypes,classType,cppInvokerFunc,cppTargetFunc,isAsync) {
  if (argTypes.length < 2 || isAsync) throwBindingError('Unsupported Manifold binding signature');
  var classMethod = argTypes[1] !== null && classType !== null;
  var stackNeeded = usesDestructorStack(argTypes);
  var returns = argTypes[0].name !== 'void';
  var count = argTypes.length - 2;
  var fn = function() {
    if (arguments.length !== count) throwBindingError('function ' + humanName + ' called with ' + arguments.length + ' arguments, expected ' + count);
    var destructors = stackNeeded ? [] : null;
    var wired = [cppTargetFunc], cleanup = [], result;
    try {
      if (classMethod) {
        var self = argTypes[1].toWireType(destructors, this);
        wired.push(self);
        if (!stackNeeded && argTypes[1].destructorFunction !== null) cleanup.push([argTypes[1].destructorFunction,self]);
      }
      for (var i=0;i<count;i++) {
        var type=argTypes[i+2], value=type.toWireType(destructors,arguments[i]);
        wired.push(value);
        if (!stackNeeded && type.destructorFunction !== null) cleanup.push([type.destructorFunction,value]);
      }
      result=cppInvokerFunc.apply(null,wired);
    } finally {
      if (stackNeeded) runDestructors(destructors);
      else for (var pair of cleanup) pair[0](pair[1]);
    }
    return returns ? argTypes[0].fromWireType(result) : undefined;
  };
  Object.defineProperty(fn,'length',{value:count});
  return createNamedFunction(humanName,fn);
}`;

const caller = `function __emval_get_method_caller(argCount,argTypes,kind) {
  argTypes >>>= 0;
  var types=emval_lookupTypes(argCount,argTypes), retType=types.shift();
  var fn=function(obj,func,destructorsRef,args) {
    var values=[],offset=0;
    for (var type of types) {
      values.push(type.readValueFromPointer(args+offset));
      offset+=type.argPackAdvance;
    }
    var result=kind===1 ? Reflect.construct(func,values) : kind===0 ? func.apply(obj,values) : Reflect.apply(func.call,func,values);
    return retType.isVoid ? undefined : emval_returnValue(retType,destructorsRef,result);
  };
  return emval_addMethodCaller(createNamedFunction('methodCaller<('+types.map(t=>t.name).join(', ')+') => '+retType.name+'>',fn));
}`;

export function cspSafeManifold(source: string) {
  const replace = (start: string, end: string, body: string) => {
    const at = source.indexOf(start),
      stop = source.indexOf(end, at);
    if (at < 0 || stop < at || source.indexOf(start, at + start.length) !== -1)
      throw new Error(
        "Manifold CSP adapter: upstream glue changed; review the pinned binding ABI.",
      );
    source = source.slice(0, at) + body + source.slice(stop);
  };
  // Drop the unused JIT string generator too, so bundles contain no reachable
  // Function-based binding factory. Guarded markers deliberately fail on drift.
  replace(
    "function createJsInvoker(",
    "var __embind_register_class_constructor=",
    invoker,
  );
  replace(
    "function __emval_get_method_caller(",
    "function __emval_get_property(",
    caller,
  );
  if (/newFunc\(Function,/.test(source))
    throw new Error("Manifold CSP adapter: unhandled dynamic binding factory.");
  return source;
}

export function manifoldCspPlugin(): Plugin {
  return {
    name: "formaforge-manifold-static-bindings",
    enforce: "pre",
    transform(code, id) {
      if (!/[/\\]manifold-3d[/\\]manifold\.js(?:\?.*)?$/.test(id)) return null;
      return { code: cspSafeManifold(code), map: null };
    },
  };
}
