window.$ = function (){
    var doc = [document];
    var uid = 1;
    var cache = {};
{
    var REGEXP_0 = /^(\s)*([\)\*,\+>~]?)\s*([\[\.\:#]?)\s*([\w\u0080-\u00FFF_\-]*)/;
    var REGEXP_1 = /^(?:\s*(\S?\=)\s*(?:([\+\-\d\.]+)|(\w+)|"((?:[^"]|`")*)"))?\s*\]/;
    var NAME_MAP = {'name':'name', 'tagName':'tagName', 'id':'#'};
    var VALUE_MAP = {'true':true, 'false':false, 'null':null, 'undefined':undefined};
    function parse(src){
        var tmp;
        var token = [];
        var sequence = [];
        var chain = [sequence];
        var group = [chain];
        sequence.combinator = ' ';
        while (src && src != ''){
            if (REGEXP_0.test(src)){
                src = RegExp.rightContext;
                tmp = RegExp.$1 || RegExp.$2;
                if (tmp){
                    if (tmp == ','){
                        sequence = [];
                        sequence.combinator = ' ';
                        chain = [sequence];
                        group.push(chain);
                    } else if (tmp == '*'){
                    } else if (tmp == ')'){
                    } else {
                        sequence = [];
                        sequence.combinator = tmp;
                        chain.push(sequence);
                    }
                }
                if (tmp = RegExp.$3 || RegExp.$4){
                    token.name = RegExp.$3 ? tmp : 'tagName';
                    if (tmp == ':'){
                        tmp = RegExp.$4;
                        if (tmp == 'not' || tmp == 'has'){
                            src = src.substring(1);
                            sequence = [];
                            sequence.combinator = tmp;
                            chain.push(sequence);
                            continue;
                        }
                        token.name = tmp;
                        if (/^\(([^\)]*)\)/.test(src)){
                            src = RegExp.rightContext;
                            tmp = RegExp.$1;
                            token.push(tmp);
                        }
                    } else if (tmp == '['){
                        tmp = RegExp.$4;
                        if (tmp == 'class'){
                            tmp = 'className';
                        }
                        token.push(tmp);
                        if (REGEXP_1.test(src)){
                            src = RegExp.rightContext;
                            if (tmp = RegExp.$1){
                                if (tmp === '=' && (tmp = NAME_MAP[token[0]])){
                                    token.name = tmp;
                                    token.length = 0;
                                } else if (tmp === '~=' && token[0] === 'className') {
                                    token.name = '.';
                                    token.length = 0;
                                } else {
                                    token.name = RegExp.$1;
                                }
                                if (tmp = RegExp.$2){
                                    tmp = Number(tmp);
                                } else if (tmp = RegExp.$3){
                                    tmp = VALUE_MAP[tmp] || tmp;
                                } else if (tmp = RegExp.$4) {
                                    tmp = tmp.replace(/`(`*")/g, '$1');
                                } else throw '';
                                token.push(tmp);
                            } else {
                                
                            }
                        } else throw '';
                    } else {
                        token.push(RegExp.$4);
                    }
                    sequence.push(token);
                    token = [];
                } else {
                }
            } else throw '';
        }
        return group;
    }
    function build(src){
        return parse(src);
    }
}
{
    function SearchFunction(){
        this.ovars = {};
        this.tests = [];
        this.ovlen = 0;
    }
    SearchFunction.prototype.setTemplate = function (template){
        this.template = template;
    };
    SearchFunction.prototype.addArg = function (name, value){
        if (!value) {
            value = name;
            name = 'P'+this.ovlen;
            this.ovlen ++;
        }
        this.ovars[name] = value;
        return name;
    };
    SearchFunction.prototype.addCon = function (condition){
        this.tests.push('('+condition+')');
    };
    SearchFunction.prototype.compile = function (){
        var fn;
        fn = this.template.toString();
        var condition = this.tests.length <= 0 ? 'true' : this.tests.join('&&');
        fn = fn.replace(/\$CONDITION\$/g, condition);
        with (this.ovars){
            return eval('fn='+fn);
        }
    };
}
{
    var $CONDITION$;
    var byTagName = function (ret){
        var hash = ret.hash = ret.hash || {};
        var checkedhash = {};
        var node;
        var nodes;
        for (var i=0; i<this.length; i++){
            node = this[i];
            node.uid = node.uid || uid++;
            //if (node.uid in checkedhash){
            //    continue;
            //} else {
            //    checkedhash[node.uid] = 1;
            //}
            nodes = node.uid + tagName;
            nodes = cache[nodes] = cache[nodes] || node.getElementsByTagName(tagName);
            for (var j=0,m=nodes.length; j<m; j++){
                node = nodes[j];
                node.uid = node.uid || uid++;
                //checkedhash[node.uid] = 1;
                if (!(node.uid in hash) && $CONDITION$){
                    hash[node.uid] = 1;
                    ret.push(node);
                }
            }
        }
        return ret;
    };
    byTagName = byTagName.toString();

    var byClassName = function (ret){
        var hash = ret.hash = ret.hash || {};
        var node;
        var nodes;
        for (var i=0; i<this.length; i++){
            node = this[i];
            node.uid = node.uid || uid++;
            nodes = node.uid + className;
            nodes = cache[nodes] = cache[nodes] || node.getElementsByClassName(className);
            for (var j=0,m=nodes.length; j<m; j++){
                node = nodes[j];
                node.uid = node.uid || uid++;
                if (!(node.uid in hash) && $CONDITION$){
                    hash[node.uid] = 1;
                    ret.push(node);
                }
            }
        }
        return ret;
    };
    byClassName = byClassName.toString();

    var byClassNameRE = function (ret){
        var hash = ret.hash = ret.hash || {};
        var node;
        var nodes;
        for (var i=0; i<this.length; i++){
            node = this[i];
            node.uid = node.uid || uid++;
            nodes = node.getElementsByTagName('*');
            for (var j=0,m=nodes.length; j<m; j++){
                node = nodes[j];
                node.uid = node.uid || uid++;
                if (classNameRE.test(node.className) && !(node.uid in hash) && $CONDITION$){
                    hash[node.uid] = 1;
                    ret.push(node);
                }
            }
        }
        return ret;
    };
    byClassNameRE = byClassNameRE.toString();

    var byId = function (ret){
        var hash = ret.hash = ret.hash || {};
        var node;
        for (var i=0; i<this.length; i++){
            node = this[i];
            node = node.getElementById(id);
            if (node){
                node.uid = node.uid || uid++;
                if (!(node.uid in hash) && $CONDITION$){
                    hash[node.uid] = 1;
                    ret.push(node);
                }
            }
        }
        return ret;
    };
    byId = byId.toString();

    var childFind = function (ret){
        var hash = ret.hash = ret.hash || {};
        var checkedhash = {};
        var node;
        for (var i=0; i<this.length; i++){
            node = this[i].firstChild;
            node.uid = node.uid || uid++;
            if (node.uid in checkedhash){
                continue;
            } else {
                checkedhash[node.uid] = 1;
            }
            while (node){
                if (node.nodeType == 1){
                    node.uid = node.uid || uid++;
                    if (!(node.uid in hash) && $CONDITION$){
                        hash[node.uid] = 1;
                        ret.push(node);
                    }
                }
                node = node.nextSibling;
            }
        }
        return ret;
    };
    childFind = childFind.toString();

    var adjustFind = function (ret){
        var hash = ret.hash = ret.hash || {};
        var checkedhash = {};
        var node;
        for (var i=0; i<this.length; i++){
            node = this[i];
            while (node = node.nextSibling){
                node.uid = node.uid || uid++;
                if (node.uid in checkedhash) {
                    break;
                } else {
                    checkedhash[node.uid] = 1;
                }
                if (!(node.uid in hash) && $CONDITION$){
                    hash[node.uid] = 1;
                    ret.push(node);
                }
            }
        }
        return ret;
    };
    adjustFind = adjustFind.toString();

    var adjustFind1 = function (ret){
        var hash = ret.hash = ret.hash || {};
        var node;
        for (var i=0; i<this.length; i++){
            node = this[i];
            node.uid = node.uid || uid++;
            while (node = node.nextSibling){
                node.uid = node.uid || uid++;
                if (node.nodeType == 1){
                    if (!(node.uid in hash) && $CONDITION$){
                        hash[node.uid] = 1;
                        ret.push(node);
                    }
                    break;
                }
            }
        }
        return ret;
    };
    adjustFind1 = adjustFind1.toString();

    var finder = {
        'tagName': function (tagName){
            this.addArg('tagName', tagName);
            this.setTemplate(byTagName);
        },
        '.': function (className){
            if (document.getElementsByClassName){
                this.addArg('className', className);
                this.setTemplate(byClassName);
            } else {
                this.addArg('classNameRE', new RegExp('(?:^|\b)'+className+'(?:\b|$)'));
                this.setTemplate(byClassNameRE);
            }
        },
        '#': function (id){
            this.addArg('id', id);
            this.setTemplate(byId);
        },
        '>': function (){
            this.setTemplate(childFind);
        },
        '~': function (){
            this.setTemplate(adjustFind);
        },
        '+': function (){
            this.setTemplate(adjustFind1);
        }
    };
    var tester = {
        ' ': function (ctx){
            if (ctx.length == 1 && ctx[0] === document) {
                
            } else {
                
            }
        },
        'tagName': function (tagName){
            tagName = this.addArg(tagName.toUpperCase());
            this.addCon('node.tagName === '+tagName);
        },
        '#': function (id){
            id = this.addArg(id);
            this.addCon('node.id === '+id);
        },
        '.': function (className){
            className = new RegExp('\\b'+className+'\\b');
            className = this.addArg(className);
            this.addCon(className+'.test(node.className)');
        },
        '[': function (attrName){
            if (attrName == 'className'){
                this.addCon('"className" in node');
            } else if (attrName == 'href'){
                this.addCon('node.getAttribute("href", 2)');
            } else {
                attrName = this.addArg(attrName);
                this.addCon('node.getAttribute('+attrName+')');
            }
        },
        '=': function (attrName, attrValue){
            attrName = this.addArg(attrName);
            attrValue = this.addArg(attrValue);
            this.addCon('node['+attrName+'] == '+attrValue);
        },
        '!=': function (attrName, attrValue){
            attrName = this.addArg(attrName);
            attrValue = this.addArg(attrValue);
            this.addCon('node['+attrName+'] !== '+attrValue);
        },
        '~=': function (attrName, attrValue){
            attrName = this.addArg(attrName);
            attrValue = new RegExp('\\b'+attrValue+'\\b');
            attrValue = this.addArg(attrValue);
            this.addCon(attrValue+'.test(node['+attrName+'])');
        },
        '|=': function (attrName, attrValue){
            attrName = this.addArg(attrName);
            attrValue = new RegExp('^'+attrValue+'(-.*)?', 'g');
            attrValue = this.addArg(attrValue);
            this.addCon(attrValue+'.test(node['+attrName+'])');
        },
        '^=': function (attrName, attrValue){
            attrName = this.addArg(attrName);
            var len = attrValue.length;
            attrValue = this.addArg(attrValue);
            this.addCon('node['+attrName+'].indexOf('+attrValue+') === 0');
        },
        '$=': function (attrName, attrValue){
            attrName = this.addArg(attrName);
            var len = attrValue.length;
            attrValue = this.addArg(attrValue);
            this.addCon('node['+attrName+'].lastIndexOf('+attrValue+') === node['+attrName+'].length-'+len);
        },
        '*=': function (attrName, attrValue){
            attrName = this.addArg(attrName);
            attrValue = this.addArg(attrValue);
            this.addCon('node['+attrName+'].indexOf('+attrValue+') >= 0');
        },
        'contains': function (text){
            text = this.addArg(new RegExp(text));
            this.addCon(text+'.test(node.textContent||node.innerText||"")');
        }
    };
}
{
    function makefn(ctx){
        var sf = new SearchFunction;
        var token, i;
        if (ctx) {
            token = this[0];
            finder[token.name].apply(sf, token);
            for (i=1; i<this.length; i++){
                token = this[i];
                tester[token.name].apply(sf, token);
            }
            tester[this.combinator].call(sf, ctx);
        } else {
            finder[this.combinator].call(sf);
            for (i=0; i<this.length; i++){
                token = this[i];
                tester[token.name].apply(sf, token);
            }
        }
        return sf.compile();
    }
    function query(ctx, ret){
        var search;
        if (this[0].name == '#' || ctx.length > 1024){
            search = makefn.call(this, ctx);
            ctx = doc;
        } else if (this.combinator === ' '){
            search = makefn.call(this, doc);
        } else {
            search = makefn.call(this);
        }
        return search.call(ctx, ret);
    }
    function chain(ctx, ret){
        var lasti = this.length - 1;
        for (var i=0; i<lasti; i++){
            ctx = query.call(this[i], ctx, []);
        }
        return query.call(this[lasti], ctx, ret);
    }
    function group(ctx, ret){
        for (var i=0; i<this.length; i++){
            chain.call(this[i], ctx, ret);
        }
        return ret;
    }
    return function (src){
        return cache[src] = cache[src] || group.call(build(src), doc, []);
    };
}
}();