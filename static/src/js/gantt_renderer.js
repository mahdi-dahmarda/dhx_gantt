odoo.define('dhx_gantt.GanttRenderer', function (require) {
    "use strict";

    var AbstractRenderer = require('web.AbstractRenderer');
    var FormRenderer = require('web.FormRenderer');
    // var BasicRenderer = require('web.BasicRenderer');
    // var dialogs = require('web.view_dialogs');

    var GanttRenderer = AbstractRenderer.extend({
        template: "dhx_gantt.gantt_view",
        ganttApiUrl: "/gantt_api",
        date_object: new Date(),
        events: _.extend({}, AbstractRenderer.prototype.events, {
            'click button.o_dhx_critical_path': '_onClickCriticalPath',
            'click button.o_dhx_reschedule': '_onClickReschedule',
            'click button.o_dhx_zoom_in': '_onClickZoomIn',
            'click button.o_dhx_zoom_out': '_onClickZoomOut'
        }),
        init: function (parent, state, params) {
            // console.log('init GanttRenderer');
            this._super.apply(this, arguments);
            this.initDomain = params.initDomain;
            this.modelName = params.modelName;
            this.map_text = params.map_text;
            this.map_id_field = params.map_id_field;
            this.map_date_start = params.map_date_start;
            this.map_duration = params.map_duration;
            this.map_open = params.map_open;
            this.map_progress = params.map_progress;
            this.map_links_serialized_json = params.map_links_serialized_json;
            this.link_model = params.link_model;
            this.is_total_float = params.is_total_float;
          
            var self = this;
            
            gantt.config.columns = [
                {name: "text", tree: true, width: 200, resize: true},
                {name: "start_date", align: "center", width: 80, resize: true},
                {name: "owner", align: "center", width: 75, label: "Owner", template: function (task) {
                    if (task.type == gantt.config.types.project) {
                        return "";
                    }
        
                    var store = gantt.getDatastore("resource");
                    var assignments = task[gantt.config.resource_property];
        
                    if (!assignments || !assignments.length) {
                        return "Unassigned";
                    }
        
                    if(assignments.length == 1){
                        return store.getItem(assignments[0].resource_id).text;
                    }
        
                    var result = "";
                    assignments.forEach(function(assignment) {
                        var owner = store.getItem(assignment.resource_id);
                        if (!owner)
                            return;
                        result += "<div class='owner-label' title='" + owner.text + "'>" + owner.text.substr(0, 1) + "</div>";
        
                    });
        
                    return result;
                    }, resize: true
                },
                {name: "duration", width: 60, align: "center"},
                {name: "add", width: 44}
            ];
        
            function getResourceAssignments(resourceId) {
                var assignments;
                var store = gantt.getDatastore(gantt.config.resource_store);
                var resource = store.getItem(resourceId);
        
                if (resource.$level === 0) {
                    assignments = [];
                    store.getChildren(resourceId).forEach(function(childId){
                        assignments = assignments.concat(gantt.getResourceAssignments(childId));
                    });
                } else if (resource.$level === 1) {
                    assignments = gantt.getResourceAssignments(resourceId);
                }else{
                    assignments = gantt.getResourceAssignments(resource.$resource_id, resource.$task_id);
                }
                return assignments;
            }
        
            var resourceConfig = {
                columns: [
                    {
                        name: "name", label: "Name", tree:true, template: function (resource) {
                            return resource.text;
                        }
                    },
                    {
                        name: "workload", label: "Workload", template: function (resource) {
                            var totalDuration = 0;
                            if (resource.$level == 2) {
                                var assignment = gantt.getResourceAssignments(resource.$resource_id, resource.$task_id)[0];
                                totalDuration = resource.duration * assignment.value;
                            } else {
                                var assignments = getResourceAssignments(resource.id);
                                assignments.forEach(function (assignment) {
                                    var task = gantt.getTask(assignment.task_id);
                                    totalDuration += Number(assignment.value) * task.duration;
                                });
                            }
        
                            return (totalDuration || 0) + "h";
                        }
                    }
                ]
            };
        
            gantt.templates.resource_cell_class = function(start_date, end_date, resource, tasks){
                var css = [];
                css.push("resource_marker");
                if (tasks.length <= 1) {
                    css.push("workday_ok");
                } else {
                    css.push("workday_over");
                }
                return css.join(" ");
            };
        
            gantt.templates.resource_cell_value = function(start_date, end_date, resource, tasks){
                var result = 0;
                tasks.forEach(function(item) {
                    var assignments = gantt.getResourceAssignments(resource.id, item.id);
                    assignments.forEach(function(assignment){
                        var task = gantt.getTask(assignment.task_id);
                        result += assignment.value * 1;
                    });
                });
        
                if(result % 1){
                    result = Math.round(result * 10)/10;
                }
                return "<div>" + result + "</div>";
            };
        
            gantt.locale.labels.section_resources = "Owners";
            gantt.config.lightbox.sections = [
                {name: "description", height: 38, map_to: "text", type: "textarea", focus: true},
                {
                    name: "resources", type: "resources", map_to: "owner", options: gantt.serverList("people"), default_value:8
                },
        
                {name: "time", type: "duration", map_to: "auto"}
            ];
        
            gantt.config.resource_store = "resource";
            gantt.config.resource_property = "owner";
            gantt.config.order_branch = true;
            gantt.config.open_tree_initially = true;
            gantt.config.layout = {
                css: "gantt_container",
                rows: [
                    {
                        cols: [
                            {view: "grid", group:"grids", scrollY: "scrollVer"},
                            {resizer: true, width: 1},
                            {view: "timeline", scrollX: "scrollHor", scrollY: "scrollVer"},
                            {view: "scrollbar", id: "scrollVer", group:"vertical"}
                        ],
                        gravity:2
                    },
                    {resizer: true, width: 1},
                    {
                        config: resourceConfig,
                        cols: [
                            {view: "resourceGrid", group:"grids", width: 435, scrollY: "resourceVScroll" },
                            {resizer: true, width: 1},
                            {view: "resourceTimeline", scrollX: "scrollHor", scrollY: "resourceVScroll"},
                            {view: "scrollbar", id: "resourceVScroll", group:"vertical"}
                        ],
                        gravity:1
                    },
                    {view: "scrollbar", id: "scrollHor"}
                ]
            };
        
        },
        _onClickCriticalPath: function(){
            // console.log('_onClickCriticalPath');
            this.trigger_up('gantt_show_critical_path');
        },
        _onClickReschedule: function(){
            // console.log('_onClickReschedule');
            this.trigger_up('gantt_schedule');
        },
        _onClickZoomIn: function(){
            // console.log('_onClickZoomIn');
            gantt.ext.zoom.zoomIn();
        },
        _onClickZoomOut: function(){
            // console.log('_onClickZoomOut');
            gantt.ext.zoom.zoomOut();
        },
        on_attach_callback: function () {
            this.renderGantt();
            // console.log('on_attach_callback');
            // console.log(this.$el);
        },
        renderGantt: function(){
            // console.log('renderGantt');
            
            gantt.init(this.$('.o_dhx_gantt').get(0));
            this.trigger_up('gantt_config');
            this.trigger_up('gantt_create_dp');
            if(!this.events_set){
                var self = this;
                gantt.attachEvent('onBeforeGanttRender', function() {
                    // console.log('tadaaaa, onBeforeGanttRender');
                    var rootHeight = self.$el.height();
                    var headerHeight = self.$('.o_dhx_gantt_header').height();
                    self.$('.o_dhx_gantt').height(rootHeight - headerHeight);
                });
                this.events_set = true;
            }
            gantt.clearAll();
            
            var rootHeight = this.$el.height();
            var headerHeight = this.$('.o_dhx_gantt_header').height();
            this.$('.o_dhx_gantt').height(rootHeight - headerHeight);

            var resourcesStore = gantt.createDatastore({
                name: gantt.config.resource_store,
                type: "treeDatastore",
                initItem: function (item) {
                    item.parent = item.parent || gantt.config.root_id;
                    item[gantt.config.resource_property] = item.parent;
                    item.open = true;
                    return item;
                }
            });
        
            resourcesStore.attachEvent("onParse", function(){
                var people = [];
                resourcesStore.eachItem(function(res){
                    if(!resourcesStore.hasChild(res.id)){
                        var copy = gantt.copy(res);
                        copy.key = res.id;
                        copy.label = res.text;
                        people.push(copy);
                    }
                });
                gantt.updateCollection("people", people);
            });
        
            resourcesStore.parse([
                {id: 1, text: "QA", parent:null},
                {id: 2, text: "Development", parent:null},
                {id: 3, text: "Sales", parent:null},
                {id: 4, text: "Other", parent:null},
                {id: 5, text: "Unassigned", parent:4},
                {id: 6, text: "John", parent:1, unit: "hours/day" },
                {id: 7, text: "Mike", parent:2, unit: "hours/day" },
                {id: 8, text: "Anna", parent:2, unit: "hours/day" },
                {id: 9, text: "Bill", parent:3, unit: "hours/day" },
                {id: 10, text: "Floe", parent:3, unit: "hours/day" }
            ]);
        
            gantt.parse(taskData);
        },
        _onUpdate: function () {
        },
        updateState: function (state, params) {
            // this method is called by the controller when the search view is changed. we should 
            // clear the gantt chart, and add the new tasks resulting from the search
            var res = this._super.apply(this, arguments);
            gantt.clearAll();
            this.renderGantt();
            return res;
        },
        disableAllButtons: function(){
            // console.log('disableAllButtons:: Renderer');
            this.$('.o_dhx_gantt_header').find('button').prop('disabled', true);
        },
        enableAllButtons: function(){
            // console.log('enableAllButtons:: Renderer');
            this.$('.o_dhx_gantt_header').find('button').prop('disabled', false);
        },
        undoRenderCriticalTasks: function(data){
            gantt.eachTask(function(item){
                item.color = "";
            });
            gantt.getLinks().forEach(function(item){
                item.color = "";
            });
            gantt.render();
        },
        renderCriticalTasks: function(data){
            data.tasks.forEach(function(item){
                var task = gantt.getTask(item);
                if(task){
                    task.color = "red";
                }
            });
            data.links.forEach(function(item){
                var link = gantt.getLink(item);
                if(link){
                    link.color = "red";
                }
            });
            if(data.tasks.length > 0){
                gantt.render();
            }
        },
        destroy: function () {
            gantt.clearAll();
            this._super.apply(this, arguments);
        },
    });
    return GanttRenderer;
});

// code that i worked so hard for i am not ready to throw it yet :D
            // Approach 1: use dhx_gantt's dataProcessor to read from server api(controller)
            // console.log('ganttApiUrl');
            // console.log(this.ganttApiUrl);
            // console.log('initDomain');
            // console.log(JSON.stringify(this.initDomain));
            // console.log('JSON.stringify(this.undefinedStuff)');
            // console.log(JSON.stringify(this.undefinedStuff));
            // console.log('1243');
            // console.log(this.ganttApiUrl);
            // console.log(this.ganttApiUrl + '?domain=');
            // console.log(this.ganttApiUrl + '?domain=' + this.initDomain ? JSON.stringify(this.initDomain) : 'False');
            // console.log(this.ganttApiUrl + '?domain=' + (this.initDomain ? JSON.stringify(this.initDomain) : 'False'));
            // console.log(this.ganttApiUrl + '?domain=' + this.initDomain);

            // var domain_value = (this.initDomain ? JSON.stringify(this.initDomain) : 'False');
            // var initUrl = this.ganttApiUrl +
            // '?domain=' + domain_value +
            // '&model_name=' + this.modelName +
            // '&timezone_offset=' + (-this.date_object.getTimezoneOffset());
            // console.log('initUrl');
            // console.log(initUrl);

            // [
            //     {name:"add", label:"", width:50, align:"left" },

            //     {name:"text",       label:textFilter, width:250, tree:true },
            //     {name:"start_date", label:"Start time", width:80, align:"center" },
            //     {name:"duration",   label:"Duration",   width:60, align:"center" }
            // ]
 

            // gantt.load(initUrl);
            // var dp = new gantt.dataProcessor(initUrl);
            // keep the order of the next 3 lines below
            // var dp = gantt.createDataProcessor({
            //     url: initUrl,
            //     mode:"REST",
            // });
            // // dp.init(gantt);
            // dp.setTransactionMode({
            //     mode: "REST",
            //     payload: {
            //         csrf_token: core.csrf_token,
            //         link_model: this.link_model,
            //         model_name: self.modelName
            //     },
            // });
            // var dp = gantt.createDataProcessor(function(entity, action, data, id){
            //     console.log('createDataProcessor');
            //     console.log('entity');
            //     console.log({entity});
            //     console.log({action});
            //     console.log({data});
            //     console.log({id});
            //     const services = {
            //         "task": this.taskService,
            //         "link": this.linkService
            //     };
            //     const service = services[entity];
            //     switch (action) {
            //         case "update":
            //             self.trigger_up('gantt_data_updated', {entity, data});
            //             return true;
            //             // return service.update(data);
            //         case "create":
            //             self.trigger_up('gantt_data_created', {entity, data});
            //             // return service.insert(data);
            //         case "delete":
            //             self.trigger_up('gantt_data_deleted', {entity, data});
            //             // return service.remove(id);
            //     }
            // });

            // dp.attachEvent("onAfterUpdate", function(id, action, tid, response){
            //     if(action == "error"){
            //         console.log('nice "an error occured :)"');
            //     }else{
            //         // self.renderGantt();
            //         return true;
            //     }
            // });
            // dp.attachEvent("onBeforeUpdate", function(id, state, data){
            //     console.log('BeforeUpdate. YAY!');
            //     data.csrf_token = core.csrf_token;
            //     data.model_name = self.modelName;
            //     data.timezone_offset = (-self.date_object.getTimezoneOffset());
            //     data.map_text = self.map_text;
            //     data.map_text = self.map_text;
            //     data.map_id_field = self.map_id_field;
            //     data.map_date_start = self.map_date_start;
            //     data.map_duration = self.map_duration;
            //     data.map_open = self.map_open;
            //     data.map_progress = self.map_progress;
            //     data.link_model = self.link_model;
            //     console.log('data are ');
            //     console.log(data);
            //     return true;
            // });

            // gantt.attachEvent("onBeforeLinkDelete", function(id, item){
            //     data.csrf_token = core.csrf_token;
            //     data.link_model = self.link_model;
            //     return true;
            // });
            // Approach 2: use odoo's mvc
            // console.log('this.state');
            // console.log(this.state);
            // console.log('SETTING TO ');
            // console.log(this.state.records);
            // gantt.init(this.$el.find('.o_dhx_gantt').get(0));