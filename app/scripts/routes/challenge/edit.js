module.exports = Em.Route.extend(SimpleAuth.AuthenticatedRouteMixin,{
    // activate: function() {},
    // deactivate: function() {},
    // setupController: function(controller, model) {
        // this.controllerFor('trial').set('model', model);
    // },
    // renderTemplate: function() {},
    // beforeModel: function() {},
    // afterModel: function() {},

    model: function() {
        var challenge = this.modelFor('challenge');
        return challenge;
    }
});
