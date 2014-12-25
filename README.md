# Awww... Another Web Worker Wrapper 

Awww is a simple web worker wrapper that was created to meet the specific requirements of my master's thesis application. 

Awww main feature is the possibility to easily transfer multiple functions to worker and invoke them with different arguments many times. 

Simple usage example

```javascript
var log = function (msg) {
    console.log(msg);
};

var workerWrapper = new WorkerWrapper();

workerWrapper.transferFunction(function add(a, b) {
    return a + b;
});
workerWrapper.add(1, 2).then(log);  
//prints 3, calculation is performed in the web worker's thread

workerWrapper.transferFunction(function addSquares(a, b) {
    return add(a*a, b*b);
});
workerWrapper.addSquares(2, 4).then(log); 
//prints 20, calculation is performed in the web worker's thread
````

## Including 
````html
<script src="awww.js"></script>
````
No minified version or JS modules support is available at the moment. The library uses a single global variable called `WorkerWrapper`

The script tries to discover its relative path with the code

````javascript
var script_path = (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1].src.split('?')[0];
})();
````
The relative path is needed to create a Web Worker object using the same script. 

## Usage

### Creation
````javascript
var workerWrapper = new WorkerWrapper();
````
Multiple objects can be created, each creates its own Web Worker object,

### Transferring functions

Function needs to be transferred to a web worker before it can be invoked. Actually, codes of functions are being sent and evaluated in the worker thread as it's not possible serialize and send functions directly to web workers.

There are two transferring functions in Awww. First of them takes a function name and a function code
````javascript
workerWrapper.transferFunctionCode("add", "function (a,b){return a+b}");
````

The second one takes just a function. The caveat is that the function needs to be named (not the variable containing the function but the function itself). 

````javascript
var addAll = function addAll () {
    var argumentsArray = Array.prototype.slice.call(arguments);
    return argumentsArray.reduce(function (acc, curr) {
        return add(acc,curr);
    }, 0);
}
workerWrapper.transferFunction(addAll);
````
As you can see `addAll` can use the `add` function transferred earlier. 

`transferFunction(function)` actually calls `function.name` to get the function name and `function.toString()` to get the function body and then calls `transferFunctionCode(name, body)`. 

###Executing functions

When the function is transferred Awww creates a proxy function so that subsequent invocations look friendly. After transferring functions mentioned above one can execute them like this

````javascript
workerWrapper.add(1, 2);
workerWrapper.addAll(1,2,3,4);
````

There is also another way which may be useful in some cases 
````javascript
workerWrapper.execute("add", [1,2]);
````
The second argument is the array of arguments that will be passed to the function execution in the worker thread. 


###Results and errors

Awww uses Deferred objects to handle asynchronous output from web workers. All functions mentioned above are prepared to return promise objects if one of the supported libraries offering Deferreds is available. The discovery algorithm works like this

1. If `Q` variable is available, use `Q.defer` and return `deferred.promise` ([Q](https://github.com/kriskowal/q)) 
2. Else if `$` variable is available use `$.Deferred` and return `deferred.promise()` ([jQuery deferred](http://api.jquery.com/category/deferred-object/))
3. Otherwise use private DeferredLike object. 


In other words, `Q` needs to be present if Awww should return [A+ promise](https://promisesaplus.com/) objects and `$` needs to be present if Awww should return [jQuery promise](http://api.jquery.com/promise/) objects. Otherwise Awww methods will return object with a promise-like API which acts similarly but is not a standard promise. 

The behavior can be modified to support other libraries by changing two fields with self-describing names in `WorkerWrapper.prototype`. Code that is used to provide `Q` support looks like this
````javascript
WorkerWrapper.prototype.Deferred = Q.defer;
WorkerWrapper.prototype.deferredToPromise = function (deferred) {
    return deferred.promise;
}
````

One way or another to handle results or errors one should call `then(resultHandler, errorHandler)`. The only argument passed to the `resultHandler` function will be just the result returned by the function execution in the worker thread. The only argument passed to the `errorHandler` function will be the error message if any error happens. 

````javascript
var log = function(result){
    console.log("Result " + result)
}

var logError = function(errorMessage){
    console.log("Error " + errorMessage);
}

workerWrapper.addAll(1,2,3,4).then(log, logError);
````
will print `Result 10`. 

Handlers can also be added to the function-transferring functions

````javascript
workerWrapper.transferFunctionCode("badSyntax", "function(x)=fff").then(log, logError);
````
will print `Error Unexpected token =`. In case there is no error the result handler's argument is just a transferred function's name. 

If there is no need to use different handlers in every transferexecution the default handlers can be set.
````javascript
workerWrapper.setDefaultErrorHandler(logError);
workerWrapper.setDefaultResultHandler(log);
````

If both default and specific handlers are set, the default ones will run earlier. 


### Contribution
Issues and pull requests are welcome. By contributing, you agree to allow the project owner to license your work under the the terms of the [MIT license](LICENSE.txt). 
