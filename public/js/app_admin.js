var knattleikrAdminApp = angular.module('knattleikrAdminApp', []);

knattleikrAdminApp.factory('apiFactory', function($http) {
   var urlBase = "api/admin/";
   var apiFactory = {};
   var getRandomizer = "?" + (new Date()).getTime();

   apiFactory.saveConfig = function(config) {
      return $http.post(urlBase + 'config', JSON.stringify(config));
   };

   apiFactory.einzelwertung = function() {
      return $http.get(urlBase + 'einzelwertung');
   };

   return apiFactory;
});

knattleikrAdminApp.controller('knattleikrAdminController', function($scope, apiFactory) {

   $scope.sessionAktiv = sessionAktiv;
   $scope.aktuellerSpieltag = aktuellerSpieltag;

   $scope.saveConfig = function() {
      apiFactory.saveConfig({aktuellerSpieltag: $scope.aktuellerSpieltag}).then(function(response) {
         switch(response.data.err) {
            case 0:
               showMessage('success', response.data.message);
               break;
            case 1:
               showMessage('danger', response.data.message);
               break;
            case 2:
               window.location.href = "/?err=1";
               break;
         }
      });
   };

   $scope.einzelwertung = function() {
      $('#spinner_einzelwertung').show();
      apiFactory.einzelwertung().then(function(response) {
         $('#spinner_einzelwertung').hide();
         switch(response.data.err) {
            case 0:
               showMessage('success', response.data.message);
               break;
            case 1:
               showMessage('danger', response.data.message);
               break;
            case 2:
               window.location.href = "/?err=1";
               break;
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