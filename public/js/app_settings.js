var knattleikrSettingsApp = angular.module('knattleikrSettingsApp', ['ngRoute']);

// Routes
knattleikrSettingsApp.config(function($routeProvider) {
   $routeProvider
      .when('/', {
         templateUrl: '/partials/settings_notify.htm'
      })
      .when('/changepw', {
         templateUrl: '/partials/settings_changepw.htm'
      })
      .otherwise({
         redirectTo: '/'
      });
});

// Factory
knattleikrSettingsApp.factory('apiFactory', function($http) {
   var urlBase = "api/settings/";
   var apiFactory = {};
   var getRandomizer = "?" + (new Date()).getTime();

   apiFactory.changePw = function(altesPasswort, neuesPasswort, neuesPasswort2) {
      return $http.post(urlBase + 'changepw', {passwordold: altesPasswort, password1: neuesPasswort, password2: neuesPasswort2});
   };

   apiFactory.saveSettings = function(notification) {
      return $http.post(urlBase + 'savesettings', {notification: notification});
   }

   return apiFactory;
});

// Controller
knattleikrSettingsApp.controller('knattleikrSettingsController', function($scope, $window, apiFactory) {

   $scope.sessionAktiv = sessionAktiv;

   $scope.templateData = {};
   $scope.templateData.passwordold = "";
   $scope.templateData.password1 = "";
   $scope.templateData.password2 = "";
   $scope.templateData.notification = notification;

   $scope.settingslinks = [
      {
         text: 'Benachrichtigungen',
         hash: '',
      },
      {
         text: 'Passwort ändern',
         hash: 'changepw',
      }
   ];

   var routeIndex = 0;
   switch($window.location.hash.substring(3)) {
      case 'changepw':
         routeIndex = 1;
         break;
      default:
         routeIndex = 0;
   }
   $scope.selectedLink = $scope.settingslinks[routeIndex];

   $scope.changePw = function() {
      $('#spinner_changepw').show();
      apiFactory.changePw($scope.templateData.passwordold, $scope.templateData.password1, $scope.templateData.password2).then(function(response) {
         $('#spinner_changepw').hide();
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

   $scope.saveSettings = function() {
      $('#spinner_savesettings').show();
      apiFactory.saveSettings($scope.templateData.notification).then(function(response) {
         $('#spinner_savesettings').hide();
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

   $scope.setAktiv = function(link) {
      $scope.selectedLink = link;
   };

   $scope.isAktiv = function(link) {
      return $scope.selectedLink === link;
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