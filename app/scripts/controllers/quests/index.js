module.exports = Em.ArrayController.extend({

    actions: {
      remove: function(quest) {
            if (confirm('Are you sure you want to remove this quest?')) {
                quest.deleteRecord();
                quest.save();
            }
            return false;
        }
    }
});
