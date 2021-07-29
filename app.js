define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var appSubmodules = [
		'globalresource',
		'localresource'
	];

	var appSubmodulesFullPath = _.map(appSubmodules, function(name) {
		return './submodules/' + name + '/' + name;
	})

	require(_.merge(appSubmodulesFullPath, [
		'bootstraptour'
	]));

	var app = {
		name: 'resources',

		css: [ 'app', 'icons' ],

		i18n: {
			'en-US': { customCss: false }
		},

		requests: {},

		subscribe: {},
		
		subModules: appSubmodules,

		appFlags: {
			flow: {},

			// For now we use that to only load the numbers classifiers the first time we load the app, since it is very unlikely to change often
			appData: {},

			showAllCallflows: (monster.config.hasOwnProperty('developerFlags') && monster.config.developerFlags.showAllCallflows) || monster.apps.auth.originalAccount.superduper_admin
		},

		actions: {},
		categories: {},
		flow: {},

		// Method used by the Monster-UI Framework, shouldn't be touched unless you're doing some advanced kind of stuff!
		load: function(callback) {
			var self = this;

			self.initApp(function() {
				callback && callback(self);
			});
		},

		// Method used by the Monster-UI Framework, shouldn't be touched unless you're doing some advanced kind of stuff!
		initApp: function(callback) {
			var self = this;

			/* Used to init the auth token and account id of self app */
			monster.pub('auth.initApp', {
				app: self,
				callback: callback
			});

			self.initHandlebarsHelpers();
		},

		initHandlebarsHelpers: function() {
			Handlebars.registerHelper('compare', function (lvalue, operator, rvalue, options) {
				var operators, result;

				if (arguments.length < 3) {
					throw new Error('Handlerbars Helper \'compare\' needs 2 parameters');
				}

				if (options === undefined) {
					options = rvalue;
					rvalue = operator;
					operator = '===';
				}

				operators = {
					'==': function (l, r) { return l == r; },
					'===': function (l, r) { return l === r; },
					'!=': function (l, r) { return l != r; },
					'!==': function (l, r) { return l !== r; },
					'<': function (l, r) { return l < r; },
					'>': function (l, r) { return l > r; },
					'<=': function (l, r) { return l <= r; },
					'>=': function (l, r) { return l >= r; },
					'typeof': function (l, r) { return typeof l == r; }
				};

				if (!operators[operator]) {
					throw new Error('Handlerbars Helper \'compare\' doesn\'t know the operator ' + operator);
				}

				result = operators[operator](lvalue, rvalue);

				if (result) {
					return options.fn(this);
				} else {
					return options.inverse(this);
				}
			});
		},

		// Entry Point of the app
		render: function(container) {
			var self = this,
				parent = _.isEmpty(container) ? $('#monster_content') : container;

			monster.pub('callflows.fetchActions', { actions: self.actions });

			self.renderEntityManager(parent);
		},

		renderEntityManager: function(container) {
			if(monster.apps.auth.currentAccount.is_reseller == true && monster.apps.auth.currentUser.priv_level == 'admin' && monster.apps.auth.currentUser.enabled == true && monster.apps.auth.currentAccount.superduper_admin == true)
				var is_superadminreseller = true;
			var self = this,
				entityActions = _
					.chain(self.actions)
					.filter('listEntities')
					.keyBy('module')
					.value(),
				template = $(self.getTemplate({
					name: 'layout',
					data: {
						is_superadminreseller: is_superadminreseller,
						actions: _
							.chain(entityActions)
							.map()
							.sortBy('name')
							.value()
					}
				}));
			//template.find('.entity-manager').hide();
			self.bindEntityManagerEvents({
				parent: container,
				template: template,
				actions: entityActions
			});

			container
				.empty()
				.append(template);
		},

		bindEntityManagerEvents: function(args) {
			var self = this,
				template = args.template,
				actions = args.actions,
				editEntity = function(type, id) {
					monster.pub(actions[type].editEntity, {
						data: id ? { id: id } : {},
						parent: template,
						target: template.find('.entity-edition .entity-content'),
						callbacks: {
							after_render: function() {
								$(window).trigger('resize');
								template.find('.entity-edition .callflow-content').animate({ scrollTop: 0 });
							},
							save_success: function(data) {
								self.refreshEntityList({
									template: template,
									actions: actions,
									entityType: type,
									activeEntityId: data.id
								});
								editEntity(type, data.id);
							},
							delete_success: function(data) {
								self.refreshEntityList({
									template: template,
									actions: actions,
									entityType: type
								});
								template.find('.entity-edition .entity-content').empty();
							}
						}
					});
				};

			self.hackResize(template.find('.entity-edition'));
			
			template.find('.entity-manager .entity-element').on('click', function() {
				var $this = $(this);
				var entityType = $this.data('type');
				
				template.find('.entity-edition .entity-header .entity-title').text(actions[entityType].name);
				self.refreshEntityList({
					template: template,
					actions: actions,
					entityType: entityType
				});
			});

			template.on('click', '.entity-header .back-button', function() {
				template.find('.entity-edition .entity-content').empty();
				template.find('.entity-edition .list-container .list').empty();
				template.find('.entity-edition .search-query').val('');
				template.find('.callflow-edition').empty();

				template.find('.callflow-app-section').hide();
				template.find('.entity-manager').show();
			});

			template.find('.entity-edition .list-add').on('click', function() {
				var type = template.find('.entity-edition .list-container .list').data('type');
				$('.entity-edition .list-container .list-element-active').removeClass('list-element-active');
				editEntity(type);
			});

			template.find('.entity-edition .list-container .list').on('click', '.list-element', function() {
				var $this = $(this),
					id = $this.data('id'),
					type = $this.parents('.list').data('type');

				$this.closest('.list').find('.list-element-active').removeClass('list-element-active');
				$this.addClass('list-element-active');

				editEntity(type, id);
			});

			template.find('.entity-edition .search-query').on('keyup', function() {
				var search = $(this).val();
				if (search) {
					$.each(template.find('.entity-edition .list-element'), function() {
						var $elem = $(this);
						if ($elem.data('search').toLowerCase().indexOf(search.toLowerCase()) >= 0) {
							$elem.show();
						} else {
							$elem.hide();
						}
					});
				} else {
					template.find('.entity-edition .list-element').show();
				}
			});
		},

		refreshEntityList: function(args) {
			var self = this,
				template = args.template,
				actions = args.actions,
				entityType = args.entityType,
				callback = args.callbacks,
				activeEntityId = args.activeEntityId || null;

			actions[entityType].listEntities(function(entities) {
				self.formatEntityData(entities, entityType);
				var listEntities = $(self.getTemplate({
					name: 'entity-list',
					data: {
						entities: entities,
						activeEntityId: activeEntityId
					}
				}));

				monster.ui.tooltips(listEntities);

				template.find('.entity-edition .list-container .list')
					.empty()
					.append(listEntities)
					.data('type', entityType);

				template.find('.callflow-app-section').hide();
				template.find('.entity-edition').show();
				template.find('.search-query').focus();

				$(window).trigger('resize');

				callback && callback();
			});
		},

		formatEntityData: function(entities, entityType) {
			var self = this;
			_.each(entities, function(entity) {
				if (entity.first_name && entity.last_name) {
					entity.displayName = entity.first_name + ' ' + entity.last_name;
				} else if (entity.name) {
					entity.displayName = entity.name;
				} else {
					entity.displayName = entity.id;
				}
			});
		},

		hackResize: function(container) {
			var self = this;

			// Adjusting the layout divs height to always fit the window's size
			$(window).resize(function(e) {
				var $listContainer = container.find('.list-container'),
					$mainContent = container.find('.callflow-content'),
					$tools = container.find('.tools'),
					$flowChart = container.find('.flowchart'),
					contentHeight = window.innerHeight - $('.core-topbar-wrapper').outerHeight(),
					contentHeightPx = contentHeight + 'px',
					innerContentHeightPx = (contentHeight - 71) + 'px';

				$listContainer.css('height', window.innerHeight - $listContainer.position().top + 'px');
				$mainContent.css('height', contentHeightPx);
				$tools.css('height', innerContentHeightPx);
				$flowChart.css('height', innerContentHeightPx);
			});
			$(window).resize();
		},

		winkstartTabs: function(template, advanced) {
			var buttons = template.find('.view-buttons'),
				tabs = template.find('.tabs');

			if (advanced) {
				buttons.find('.btn').removeClass('activate');
				buttons.find('.advanced').addClass('activate');
			} else {
				if (monster.config.advancedView) {
					buttons.find('.btn').removeClass('activate');
					buttons.find('.advanced').addClass('activate');
				} else {
					tabs.hide('blind');
				}
			}

			if (tabs.find('li').length < 2) {
				buttons.hide();
			}

			buttons.find('.basic').on('click', function() {
				var $this = $(this);

				if (!$this.hasClass('activate')) {
					buttons.find('.btn').removeClass('activate');
					$this.addClass('activate');
					tabs.find('li:first-child > a').trigger('click');
					tabs.hide('blind');
				}
			});

			buttons.find('.advanced').click(function() {
				var $this = $(this);

				if (!$this.hasClass('activate')) {
					buttons.find('.btn').removeClass('activate');
					$this.addClass('activate');
					tabs.show('blind');
				}
			});

			tabs.find('li').on('click', function(ev) {
				ev.preventDefault();

				var $this = $(this),
					link = $this.find('a').attr('href');

				tabs.find('li').removeClass('active');
				template.find('.pill-content >').removeClass('active');

				$this.addClass('active');
				template.find(link).addClass('active');
			});
		}
	};

	return app;
});
