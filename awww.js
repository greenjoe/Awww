if (this.document) {
    //Browser part
    var WorkerWrapper = function () {
        "use strict";
        var DeferredLike = function () {
            this.errorHandlers = [];
            this.resultHandlers = [];
            this.rejected = false;
            this.resolved = false;
            this.result = null;
            this.error = null;
        };

        var createDeferredLike = function () {
            return new DeferredLike();
        };

        DeferredLike.prototype.then = function (resultHandler, errorHandler) {
            if (typeof resultHandler == "function") {
                this.resultHandlers.push(resultHandler);
                if (this.resolved) {
                    resultHandler.call(this, this.result);
                }
            }
            if (typeof errorHandler == "function") {
                this.errorHandlers.push(errorHandler);
                if (this.rejected) {
                    errorHandler.call(this, this.error);
                }
            }
        };

        DeferredLike.prototype.resolve = function (result) {
            this.resolved = true;
            this.result = result;
            var that = this;
            this.resultHandlers.forEach(function (handler) {
                handler.call(that, that.result);
            });
        };

        DeferredLike.prototype.reject = function (error) {
            this.rejected = true;
            this.error = error;
            var that = this;
            this.errorHandlers.forEach(function (handler) {
                handler.call(that, that.error);
            });
        };


        var script_path = (function () {
            var scripts = document.getElementsByTagName('script');
            return scripts[scripts.length - 1].src.split('?')[0];
        })();

        var WorkerWrapper = function () {
            this.worker = new Worker(script_path);
            this.counter = 0;
            this.deferreds = {};
            var that = this;
            this.worker.onmessage = function (message) {
                var id = message.data.id;
                var type = message.data.type;
                var deferred = that.deferreds[id];
                if (deferred) {
                    delete that.deferreds[id];
                    if (type == "success") {
                        var result = message.data.result;
                        deferred.resolve(result);
                    } else if (type == "error") {
                        var errorMessage = message.data.error;
                        deferred.reject(errorMessage);
                    }
                }
            }
        };

        if (typeof Q !== "undefined") {
            WorkerWrapper.prototype.Deferred = Q.defer;
            WorkerWrapper.prototype.deferredToPromise = function (deferred) {
                return deferred.promise;
            }
        } else if (typeof $ !== "undefined") {
            WorkerWrapper.prototype.Deferred = $.Deferred;
            WorkerWrapper.prototype.deferredToPromise = function (deferred) {
                return deferred.promise();
            }
        } else {
            WorkerWrapper.prototype.Deferred = createDeferredLike;
            WorkerWrapper.prototype.deferredToPromise = function (deferred) {
                return deferred;
            }
        }

        WorkerWrapper.prototype.setDefaultErrorHandler = function (errorHandler) {
            this.defaultErrorHandler = errorHandler;
        };

        WorkerWrapper.prototype.setDefaultResultHandler = function (resultHandler) {
            this.defaultResultHandler = resultHandler;
        };

        WorkerWrapper.prototype.attachDefaultHandlers = function (promise) {
            promise.then(this.defaultResultHandler, this.defaultErrorHandler);
            return promise;
        };

        WorkerWrapper.prototype.createProxyFunction = function (functionName) {
            var that = this;
            return function () {
                var argumentsArray = Array.prototype.slice.call(arguments);
                return that.execute(functionName, argumentsArray);
            };
        };

        WorkerWrapper.prototype.transferFunction = function (func) {
            return this.transferFunctionCode(func.name, "(" + func.toString() + ")")
        };

        WorkerWrapper.prototype.transferFunctionCode = function (functionName, functionBody) {
            this[functionName] = this.createProxyFunction(functionName);
            return this.sendCommandToWorker("function", {name: functionName, body: functionBody});
        };

        WorkerWrapper.prototype.execute = function (functionName, argumentsArray) {
            return this.sendCommandToWorker("execution", {name: functionName, arguments: argumentsArray});
        };

        WorkerWrapper.prototype.sendCommandToWorker = function (commandType, commandContent) {
            var deferred = this.Deferred();
            this.deferreds[this.counter] = deferred;
            this.worker.postMessage({
                type: commandType, id: this.counter, content: commandContent
            });
            this.counter++;
            return this.attachDefaultHandlers(this.deferredToPromise(deferred));
        };

        return WorkerWrapper;
    }()
} else {
    //Worker part
    onmessage = function (msg) {
        var id = msg.data.id;
        var type = msg.data.type;
        var content = msg.data.content;
        try {
            if (type == "function") {
                var functionName = content.name;
                var functionBody = content.body;
                this[functionName] = eval("(" + functionBody + ")");
                postMessage({id: id, type: "success", result: functionName});
            } else if (type == "execution") {
                var functionName = content.name;
                var arguments = content.arguments;
                var result = this[functionName].apply(this, arguments);
                postMessage({id: id, type: "success", result: result});
            }
        } catch (error) {
            postMessage({id: id, type: "error", error: error.message});
        }
    }
}