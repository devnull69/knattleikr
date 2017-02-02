var knattleikrAdminApp = angular.module('knattleikrAdminApp', []);

knattleikrAdminApp.factory('apiFactory', function($http) {
   var urlBase = "api/admin/";
   var apiFactory = {};
   var getRandomizer = "?" + (new Date()).getTime();

   apiFactory.saveConfig = function(config) {
      return $http.post(urlBase + 'config', JSON.stringify(config));
   };

   return apiFactory;
});

knattleikrAdminApp.controller('knattleikrAdminController', function($scope, apiFactory) {

   $scope.sessionAktiv = sessionAktiv;
   $scope.aktuellerSpieltag = aktuellerSpieltag;

   $scope.saveConfig = function() {
      apiFactory.saveConfig({aktuellerSpieltag: $scope.aktuellerSpieltag}).then(function(response) {
         if(response.data.err == 0) {
            showMessage('success', response.data.message);
         }
      });
   };

});

function showMessage(type, message) {
   $alertmessage = $('#alertmessage');
   // Message-Typ einsetzen
   $alertmessage.addClass('alert-' + type);

   $('#messagetext').text(message);
   $alertmessage.show();

   window.setTimeout(() => {
      $alertmessage.hide('slow', () => {
         // Message-Typ entfernen
         $alertmessage.removeClass('alert-' + type);
      });
   }, 5000);
}

function isBreakpoint( alias ) {
    return $('.device-' + alias).is(':visible');
}