/*

	This file is a part of node-on-train project.

	Copyright (C) Thanh D. Dang <thanhdd.it@gmail.com>

	node-on-train is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	node-on-train is distributed in the hope that it will be useful, but
	WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
	General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.

	*/


	var fs = require('fs');
	var Fiber = require('fibers');
	var RoutePattern = require('route-pattern');
	var colors = require('colors');

	var initServer = function() {
		var routes;
		var controllers = {};
		var models = [];
		var listFiles = require('./helpers/list_files.js');
		var stringHelper = require('./helpers/string_helper.js');

		ROUTE_PATTERNS = [];
		ROOT_APP = process.cwd();
		routes = require(ROOT_APP + '/config/routes.js');

		CONFIG = { initializers: {} };

		if ( fs.existsSync(ROOT_APP + '/config/database.json') && fs.existsSync(ROOT_APP + '/node_modules/sequelize/lib/sequelize.js') ) {
			CONFIG.env = 'development';
			var env_param_index = process.argv.indexOf("-e");
			if ( env_param_index > -1 && process.argv[ env_param_index ] && options( process.argv[ env_param_index ] ) ) {
				CONFIG.env = process.argv[ env_param_index ];
			}

			var config = require(ROOT_APP + '/config/database.json')[CONFIG.env];
			var Sequelize = require(ROOT_APP + '/node_modules/sequelize/lib/sequelize.js');
			CONFIG.database = new Sequelize(config.database, config.username, config.password, config);
		}

		ModelSync = function(promise) {
			var fiber = Fiber.current;
			promise.then(function (result) {
				fiber.run(result);
			}).catch(function(err) {
				fiber.run(err);
			});
			return Fiber.yield();
		};

		var initializers_files = listFiles(ROOT_APP + '/config/initializers');
		for (var f_i = 0; f_i < initializers_files.length; f_i++) {
			var info = initializers_files[f_i].split(' ');
			if (info[0] == 'f') {
				var file_path = info[1];
				var path = file_path.split('/');
				var initializer_name = path[ path.length - 1 ];
				var initializer = initializer_name.split('.js')[0];
				CONFIG.initializers[initializer] = require(file_path);
			}
		}

	// Load all controllers
	var controller_files = listFiles(ROOT_APP + '/app/controllers');
	for (var f_i = 0; f_i < controller_files.length; f_i++) {
		var info = controller_files[f_i].split(' ');
		if (info[0] == 'f') {
			var file_path = info[1];
			var path = file_path.split('/');
			var controller_name = path[ path.length - 1 ];
			var resource = controller_name.split('_controller')[0];
			controllers[resource] = require(file_path);
		}
	}

	for (var c in controllers) {
		if (c != 'application') {
			controllers[c].prototype = new controllers['application']();
			controllers[c].prototype.constructor = controllers[c];
		}
	}

	var model_files = listFiles(ROOT_APP + '/app/models');
	for (var f_i = 0; f_i < model_files.length; f_i++) {
		var info = model_files[f_i].split(' ');
		if (info[0] == 'f') {
			var file_path = info[1];
			var path = file_path.split('/');
			var model_name = path[ path.length - 1 ];
			var model = stringHelper.toTitleCase( model_name.split('.js')[0] );
			model = stringHelper.Underscore2CamelCase( model );
			global[model] = require(file_path);
			models[model] = global[model];
		}
	}

	for (var m_i in models) {
		if (models[m_i].associate) {
			models[m_i].associate(models);
		}
	}

	return {
		routes: routes,
		controllers: controllers
	}
};

var newServer = function(app, global_v) {
	var routes = global_v.routes;

	for (var k in routes) {
		if (routes[k]['resources']) {
			if (routes[k]['only'] && routes[k]['only'].length) {
				for (var a = 0; a < routes[k]['only'].length; a++) {
					var action = routes[k]['only'][a];
					var method = 'get';
					var pattern = RoutePattern.fromString('/' + routes[k]['resources']);
					if (action == 'create') {
						method = 'post';
					} else if (action == 'show') {
						pattern = RoutePattern.fromString('/' + routes[k]['resources'] + '/:id');
					} else if (action == 'update') {
						method = 'put';
						pattern = RoutePattern.fromString('/' + routes[k]['resources'] + '/:id');
					} else if (action == 'destroy') {
						method = 'delete';
						pattern = RoutePattern.fromString('/' + routes[k]['resources'] + '/:id');
					}

					ROUTE_PATTERNS.push({
						method: method,
						pattern: pattern,
						resource: routes[k]['resources'],
						action: action
					});
				}
			} else {
				ROUTE_PATTERNS.push({
					method: 'get',
					pattern: RoutePattern.fromString('/' + routes[k]['resources']),
					resource: routes[k]['resources'],
					action: 'index'
				});
				ROUTE_PATTERNS.push({
					method: 'post',
					pattern: RoutePattern.fromString('/' + routes[k]['resources']),
					resource: routes[k]['resources'],
					action: 'create'
				});
				ROUTE_PATTERNS.push({
					method: 'get',
					pattern: RoutePattern.fromString('/' + routes[k]['resources'] + '/:id'),
					resource: routes[k]['resources'],
					action: 'show'
				});
				ROUTE_PATTERNS.push({
					method: 'put',
					pattern: RoutePattern.fromString('/' + routes[k]['resources'] + '/:id'),
					resource: routes[k]['resources'],
					action: 'update'
				});
				ROUTE_PATTERNS.push({
					method: 'delete',
					pattern: RoutePattern.fromString('/' + routes[k]['resources'] + '/:id'),
					resource: routes[k]['resources'],
					action: 'destroy'
				});
			}

			if (routes[k]['member'] && routes[k]['member'].length) {
				for (var m = 0; m < routes[k]['member'].length; m++) {
					var member = routes[k]['member'][m];
					if (member['get']) {
						ROUTE_PATTERNS.push({
							method: 'get',
							pattern: RoutePattern.fromString('/' + routes[k]['resources'] + '/:id/' + member['get']),
							resource: routes[k]['resources'],
							action: member['get']
						});
					} else if (member['post']) {
						ROUTE_PATTERNS.push({
							method: 'post',
							pattern: RoutePattern.fromString('/' + routes[k]['resources'] + '/:id/' + member['post']),
							resource: routes[k]['resources'],
							action: member['post']
						});
					} else if (member['put']) {
						ROUTE_PATTERNS.push({
							method: 'put',
							pattern: RoutePattern.fromString('/' + routes[k]['resources'] + '/:id/' + member['put'] + '/:id'),
							resource: routes[k]['resources'],
							action: member['put']
						});
					} else if (member['delete']) {
						ROUTE_PATTERNS.push({
							method: 'delete',
							pattern: RoutePattern.fromString('/' + routes[k]['resources'] + '/:id/' + member['delete'] + '/:id'),
							resource: routes[k]['resources'],
							action: member['delete']
						});
					}
				}
			}
		} else {
			var method = 'get';
			var url = '/';

			if (routes[k]['method'] && routes[k]['url']) {
				method = routes[k]['method'].toLowerCase();
				url = routes[k]['url'];
			} else {
				if (routes[k]['get']) {
					method = 'get';
				} else if (routes[k]['post']) {
					method = 'post';
				} else if (routes[k]['put']) {
					method = 'put';
				} else if (routes[k]['delete']) {
					method = 'delete';
				}
				url = routes[k][method];
			}

			var url_path = url.split('/');
			var resource = routes[k]['controller'] ? routes[k]['controller'] : url_path[1];
			var action = routes[k]['action'];

			if (!routes[k]['action'] && url_path.length > 2) {
				action = url_path[2];
				if (method == 'get')
					action = 'show';
				else if (method == 'put')
					action = 'update';
				else if (method == 'delete')
					action = 'destroy';
			} else if (!routes[k]['action'] && url_path.length > 1) {
				action = 'index';
				if (method == 'post')
					action = 'create';
			}

			ROUTE_PATTERNS.push({
				method: method,
				pattern: RoutePattern.fromString(url),
				resource: resource,
				action: action
			});
		}
	}
};

module.exports.newServer = newServer;
module.exports.initServer = initServer;
