var knattleikrTabelleApp = angular.module('knattleikrTabelleApp', []);

knattleikrTabelleApp.factory('apiFactory', function($http) {
   var urlBase = "api/";
   var apiFactory = {};
   var getRandomizer = "?" + (new Date()).getTime();

   return apiFactory;
});

knattleikrTabelleApp.controller('knattleikrTabelleController', function($scope, apiFactory) {

   $scope.sessionAktiv = sessionAktiv;
   $scope.aktuellerSpieltag = aktuellerSpieltag;

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