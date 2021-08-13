define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'localResourceDefineActions',
			'callflows.resource.popupEdit': 'localResourcePopupEdit',
			'callflows.localresource.edit': '_localResourceEdit'
		},

		localResourcePopupEdit: function(args) {
			var self = this,
				popup,
				popup_html,
				data = args.data,
				callback = args.callback,
				data_defaults = args.data_defaults;

			popup_html = $('<div class="inline_popup callflows-port"><div class="inline_content main_content"/></div>');

			self.localResourceEdit(data, popup_html, $('.inline_content', popup_html), {
				save_success: function(_data) {
					popup.dialog('close');

					if (typeof callback === 'function') {
						callback(_data);
					}
				},
				delete_success: function() {
					popup.dialog('close');

					if (typeof callback === 'function') {
						callback({ data: {} });
					}
				},
				after_render: function() {
					popup = monster.ui.dialog(popup_html, {
						title: (data.id) ? self.i18n.active().resources.edit_gateway : self.i18n.active().resources.create_gateway
					});
				}
			}, data_defaults);
		},

		// Added for the subscribed event to avoid refactoring localResourceEdit
		_localResourceEdit: function(args) {
			var self = this;
			self.localResourceEdit(args.data, args.parent, args.target, args.callbacks, args.data_defaults);
		},

		localResourceEdit: function(data, _parent, _target, _callbacks, data_defaults) {
			var self = this,
				parent = _parent || $('#resource-content'),
				target = _target || $('#resource-view', parent),
				_callbacks = _callbacks || {},
				callbacks = {
					save_success: _callbacks.save_success,
					save_error: _callbacks.save_error,
					delete_success: _callbacks.delete_success,
					delete_error: _callbacks.delete_error,
					after_render: _callbacks.after_render
				},
				defaults = {
					data: $.extend(true, {
						weight_cost: 50,
						enabled: true,
						gateways: [
							{
								codecs: ['PCMU', 'PCMA'],
								progress_timeout: '6',
								port: "5060"
							}
						],
						rules: [
							'^.*$'
						],
						caller_id_options: {
							type: 'external'
						},
						flags: [],
						caller_id: {
							external: {},
							internal: {},
							emergency: {}
						},
						media: {
							audio: {
								codecs: ['PCMU', 'PCMA']
							},
							video: {
								codecs: []
							}
						}
					}, data_defaults || {}),

					field_data: {
						users: [],
						call_restriction: {},
						caller_id_options: {
							type: {
								'external': 'external',
								'internal': 'internal',
								'emergency': 'emergency'
							}
						},
						media: {
							audio: {
								codecs: {
									'OPUS': 'OPUS',
									'G722_32': 'G722.1 @ 32khz',
									'G722_16': 'G722.1 @ 16khz',
									'Speex': 'Speex @ 16khz',
									'PCMU': 'G711u / PCMU - 64kbps',
									'PCMA': 'G711a / PCMA - 64kbps',
									'G729': 'G729 - 8kbps (Requires License)',
									'GSM': 'GSM',
									'CELT_48': 'Siren (HD) @ 48kHz',
									'CELT_64': 'Siren (HD) @ 64kHz'
								}
							},
							video: {
								codecs: {
									'VP8': 'VP8',
									'H264': 'H264',
									'H263': 'H263',
									'H261': 'H261'
								}
							}
						},
						hide_owner: data.hide_owner || false,
						outbound_flags: data.outbound_flags ? data.outbound_flags.join(', ') : data.outbound_flags
					},
					functions: {
						inArray: function(value, array) {
							if (array) {
								return ($.inArray(value, array) === -1) ? false : true;
							} else {
								return false;
							}
						}
					}
				},
				parallelRequests = function(resourceData) {
					monster.parallel({
						provisionerData: function(callback) {
							callback(null, {});
						}
					},
					function(err, results) {
						var render_data = self.localResourcePrepareDataForTemplate(data, defaults, $.extend(true, results, {
							get_resource: resourceData
						}));

						self.localResourceRender(render_data, target, callbacks);

						if (typeof callbacks.after_render === 'function') {
							callbacks.after_render();
						}
					});
				};

			if (typeof data === 'object' && data.id) {
				self.localResourceGet(data.id, function(_data, status) {
					defaults.data.resource_type = 'local_resource';

					parallelRequests(_data);
				});
			} else {
				parallelRequests(defaults);
			}
		},

		localResourcePrepareDataForTemplate: function(data, dataLocal, results) {
			var self = this,
				dataResource = results.get_resource,
				dataProvisioner = results.provisionerData;

			if (typeof data === 'object' && data.id) {
				dataLocal = $.extend(true, dataLocal, { data: dataResource });
			}

			if (dataResource.hasOwnProperty('media') && dataResource.media.hasOwnProperty('audio')) {
				// If the codecs property is defined, override the defaults with it. Indeed, when an empty array is set as the
				// list of codecs, it gets overwritten by the extend function otherwise.
				if (dataResource.media.audio.hasOwnProperty('codecs')) {
					dataLocal.data.media.audio.codecs = dataResource.media.audio.codecs;
				}
			}

			dataLocal.field_data.provisioner = dataProvisioner;
			dataLocal.field_data.provisioner.isEnabled = !_.isEmpty(dataProvisioner);

			dataLocal.extra = dataLocal.extra || {};
			dataLocal.extra.isShoutcast = false;

			return dataLocal;
		},

		localResourceGetValidationByResourceType: function(resourceType) {
			var self = this,
				i18n = self.i18n.active(),
				validation = {},
				resourceTypeValidation = {
					rules: validation[resourceType]
				};

			if (_.includes(['local_resource'], resourceType)) {
				_.merge(resourceTypeValidation, {
					rules: {
						'#name':                   { regex: /^.+$/ },
						'#weight_cost':            { regex: /^[0-9]+$/ },
						'#rules':                  { regex: /^.*$/ },
						'#caller_id_options_type': { regex: /^\w*$/ },
						'#gateways_username':      { regex: /^.*$/ },
						'#gateways_password':      { regex: /^[^\s]*$/ },
						'#gateways_prefix':        { regex: /^[\+]?[\#0-9]*$/ },
						'#gateways_suffix':        { regex: /^[0-9]*$/ },
						'#gateways_progress_timeout': { regex: /^[0-9]*$/ }
					},
					messages: {
						'#name': { regex: i18n.resources.validation.name },
						'#weight_cost': { regex: i18n.resources.validation.weight_cost },
						'#rules': { regex: i18n.resources.validation.rules },
						'#caller_id_options_type': { regex: i18n.resources.validation.caller_id_options_type },
						'#gateways_username': { regex: i18n.resources.validation.gateways.username },
						'#gateways_password': { regex: i18n.resources.validation.gateways.password },
						'#gateways_prefix': { regex: i18n.resources.validation.gateways.prefix },
						'#gateways_suffix': { regex: i18n.resources.validation.gateways.suffix },
						'#gateways_progress_timeout': { regex: i18n.resources.validation.gateways.progress_timeout },
					}
				});
			}

			return resourceTypeValidation;
		},

		localResourceRender: function(data, target, callbacks) {
			var self = this,
				localresource_html;

			if (typeof data.data === 'object' && data.data.resource_type) {
				localresource_html = $(self.getTemplate({
					name: data.data.resource_type,
					data: _.merge({
						showPAssertedIdentity: monster.config.whitelabel.showPAssertedIdentity
					}, data),
					submodule: 'localresource'
				}));

				var resourceForm = localresource_html.find('#resource-form');

				/* Do resource type specific things here */
				if ($.inArray(data.data.resource_type, ['local_resource']) > -1) {
					monster.ui.protectField(localresource_html.find('#gateways_password'), localresource_html);
				}

				monster.ui.validate(resourceForm, self.localResourceGetValidationByResourceType(data.data.resource_type));

				if (!$('#owner_id', localresource_html).val()) {
					$('#edit_link', localresource_html).hide();
				}

				localresource_html.find('input[data-mask]').each(function() {
					var $this = $(this);
					monster.ui.mask($this, $this.data('mask'));
				});

				$('#ip_block', localresource_html).hide();

			} else {
				localresource_html = $(self.getTemplate({
					name: 'general_edit',
					submodule: 'localresource'
				}));

				$('.media_pane', localresource_html).show();
			}

			$('*[rel=popover]:not([type="text"])', localresource_html).popover({
				trigger: 'hover'
			});

			$('*[rel=popover][type="text"]', localresource_html).popover({
				trigger: 'focus'
			});

			self.winkstartTabs(localresource_html);

			self.localResourceBindEvents({
				data: data,
				template: localresource_html,
				callbacks: callbacks
			});

			(target)
				.empty()
				.append(localresource_html);

			$('.media_tabs .buttons[resource_type="local_resource"]', localresource_html).trigger('click');
		},

		/**
		 * Bind events for the resource edit template
		 * @param  {Object} args
		 * @param  {Object} args.data
		 * @param  {Object} args.template
		 * @param  {Object} args.callbacks
		 * @param  {Function} args.callbacks.save_success
		 * @param  {Function} args.callbacks.delete_success
		 */
		localResourceBindEvents: function(args) {
			var self = this,
				data = args.data,
				callbacks = args.callbacks,
				localresource_html = args.template;

			if (typeof data.data === 'object' && data.data.resource_type) {
				var resourceForm = localresource_html.find('#resource-form');
				$('#owner_id', localresource_html).change(function() {
					!$('#owner_id option:selected', localresource_html).val() ? $('#edit_link', localresource_html).hide() : $('#edit_link', localresource_html).show();
				});

				$('.inline_action', localresource_html).click(function(ev) {
					var _data = ($(this).data('action') === 'edit') ? { id: $('#owner_id', localresource_html).val() } : {},
						_id = _data.id;

					ev.preventDefault();

					monster.pub('callflows.user.popupEdit', {
						data: _data,
						callback: function(user) {
							/* Create */
							if (!_id) {
								$('#owner_id', localresource_html).append('<option id="' + user.id + '" value="' + user.id + '">' + user.first_name + ' ' + user.last_name + '</option>');
								$('#owner_id', localresource_html).val(user.id);
								$('#edit_link', localresource_html).show();
							} else {
								/* Update */
								if (_data.hasOwnProperty('id')) {
									$('#owner_id #' + user.id, localresource_html).text(user.first_name + ' ' + user.last_name);
								/* Delete */
								} else {
									$('#owner_id #' + _id, localresource_html).remove();
									$('#edit_link', localresource_html).hide();
								}
							}
						}
					});
				});

				$('.resource-save', localresource_html).click(function(ev) {
					ev.preventDefault();

					var $this = $(this);

					if (!$this.hasClass('disabled')) {
						$this.addClass('disabled');
						if (monster.ui.valid(resourceForm)) {
							var form_data = monster.ui.getFormData('resource-form');

							self.resourceCleanFormData(form_data);

							self.localResourceSave(form_data, data, callbacks.save_success);
						} else {
							$this.removeClass('disabled');
							monster.ui.alert('error', self.i18n.active().resources.there_were_errors_on_the_form);
						}
					}
				});

				$('.resource-delete', localresource_html).click(function(ev) {
					ev.preventDefault();

					monster.ui.confirm(self.i18n.active().resources.are_you_sure_you_want_to_delete, function() {
						self.localResourceDelete(data.data.id, callbacks.delete_success);
					});
				});
			} else {
				data.data.resource_type = "local_resource";

				self.localResourceRender(data, $('.media_pane', localresource_html), callbacks);
			}
		},

		resourceCleanFormData: function(form_data) {

			if ('media' in form_data && 'audio' in form_data.media) {
				form_data.media.audio.codecs = $.map(form_data.media.audio.codecs, function(val) { return (val) ? val : null; });
			}

			delete form_data.extra;

			return form_data;
		},

		resourceFixArrays: function(data, data2) {
			if (typeof data.gateways[0] === 'object' && typeof data2.gateways[0] === 'object') {
				(data.gateways[0] || {}).codecs = (data2.gateways[0] || {}).codecs;
			}

			return data;
		},

		localResourceSave: function(form_data, data, success) {
			var self = this,
				id = (typeof data.data === 'object' && data.data.id) ? data.data.id : undefined,
				normalized_data = self.resourceFixArrays($.extend(true, {}, data.data, form_data), form_data);
				
			if (id) {
				self.localResourceUpdate(normalized_data, function(_data, status) {
					success && success(_data, status, 'update');
				});
			} else {
				self.localResourceCreate(normalized_data, function(_data, status) {
					success && success(_data, status, 'create');
				});
			}
		},

		localResourceList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'localResources.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		localResourceGet: function(resourceId, callback) {
			var self = this;

			self.callApi({
				resource: 'localResources.get',
				data: {
					accountId: self.accountId,
					resourceId: resourceId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		localResourceCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'localResources.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		localResourceUpdate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'localResources.update',
				data: {
					accountId: self.accountId,
					resourceId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		localResourceDelete: function(resourceId, callback) {
			var self = this;

			self.callApi({
				resource: 'localResources.delete',
				data: {
					accountId: self.accountId,
					resourceId: resourceId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		localResourceDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			$.extend(callflow_nodes, {
				'localresource[id=*]': {
					name: self.i18n.active().resources.localresource,
					icon: 'phone',
					category: self.i18n.active().oldResources.advanced_cat,
					module: 'localresource',
					tip: self.i18n.active().resources.localresource_tip,
					data: {
						id: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 10,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if (id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						var _this = this;

						self.localResourceList(function(resources) {
							var popup, popup_html;

							popup_html = $(self.getTemplate({
								name: 'callflowEdit',
								data: {
									can_call_self: node.getMetadata('can_call_self') || false,
									parameter: {
										name: 'timeout (s)',
										value: node.getMetadata('timeout') || '20'
									},
									objects: {
										items: _.sortBy(resources, 'name'),
										selected: node.getMetadata('id') || ''
									}
								},
								submodule: 'localresource'
							}));

							if ($('#resource_selector option:selected', popup_html).val() === undefined) {
								$('#edit_link', popup_html).hide();
							}

							$('.inline_action', popup_html).click(function(ev) {
								var _data = ($(this).data('action') === 'edit') ? { id: $('#resource_selector', popup_html).val() } : {};

								ev.preventDefault();

								self.localResourcePopupEdit({
									data: _data,
									callback: function(resource) {
										node.setMetadata('id', resource.id || 'null');
										node.setMetadata('timeout', $('#parameter_input', popup_html).val());
										node.setMetadata('can_call_self', $('#resource_can_call_self', popup_html).is(':checked'));

										node.caption = resource.name || '';

										popup.dialog('close');
									}
								});
							});

							$('#add', popup_html).click(function() {
								node.setMetadata('id', $('#resource_selector', popup_html).val());
								node.setMetadata('timeout', $('#parameter_input', popup_html).val());
								node.setMetadata('can_call_self', $('#resource_can_call_self', popup_html).is(':checked'));

								node.caption = $('#resource_selector option:selected', popup_html).text();

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().resources.localResource_title,
								beforeClose: function() {
									if (typeof callback === 'function') {
										callback();
									}
								}
							});
						});
					},
					listEntities: function(callback) {
						monster.parallel({
							localResource: function(callback) {
								self.callApi({
									resource: 'localResources.list',
									data: {
										accountId: self.accountId,
										filters: {
											paginate: false
										}
									},
									success: function(data, status) {
										callback && callback(null, data.data);
									}
								});
							}
						},
						function(err, results) {
							_.each(results.localResource, function(localResource) {
								// no jQuery wrapper since this template will be inserted directly with Handlebars
								localResource.customEntityTemplate = '<div class="title standalone">' + localResource.name + '</div>'
							});

							callback && callback(results.localResource);
						});
					},
					editEntity: 'callflows.localresource.edit'
				}
			});
		}
	};

	return app;
});