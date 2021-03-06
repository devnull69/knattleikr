var knattleikrAdminApp = angular.module('knattleikrAdminApp', ['ngRoute']);

// Routes
knattleikrAdminApp.config(function($routeProvider) {
   $routeProvider
      .when('/', {
         templateUrl: '/partials/admin_aktspieltag.htm'
      })
      .when('/gesamtwertung', {
         templateUrl: '/partials/admin_gesamtwertung.htm'
      })
      .when('/totowertung', {
         templateUrl: '/partials/admin_totowertung.htm'
      })
      .when('/spieltagwertung', {
         templateUrl: '/partials/admin_spieltagwertung.htm'
      })
      .when('/lieferantenwertung', {
         templateUrl: '/partials/admin_lieferantenwertung.htm'
      })
      .when('/sendmail', {
         templateUrl: '/partials/admin_sendmail.htm'
      })
      .when('/invalidatecache', {
         templateUrl: '/partials/admin_invalidatecache.htm'
      })
      .when('/checkjob', {
         templateUrl: '/partials/admin_checkjob.htm'
      })
      .otherwise({
         redirectTo: '/'
      });
});

// Factory
knattleikrAdminApp.factory('apiFactory', function($http) {
   var urlBase = "api/admin/";
   var apiFactory = {};
   var getRandomizer = "?" + (new Date()).getTime();

   apiFactory.saveConfig = function(config) {
      return $http.post(urlBase + 'config', JSON.stringify(config));
   };

   apiFactory.sendMail = function(joinNicknames, betreff, mailbody) {
      return $http.post(urlBase + 'sendmail', {joinNicknames: joinNicknames, betreff: betreff, mailbody: mailbody});
   };

   apiFactory.einzelwertung = function() {
      return $http.get(urlBase + 'einzelwertung');
   };

   apiFactory.totowertung = function() {
      return $http.get(urlBase + 'totowertung');
   };

   apiFactory.spieltagwertung = function(spieltagNr) {
      return $http.get(urlBase + 'spieltag/' + spieltagNr + '/wertung');
   };

   apiFactory.lieferantenwertung = function() {
      return $http.get(urlBase + 'lieferantenwertung');
   };

   apiFactory.invalidateCache = function() {
      return $http.get(urlBase + 'invalidatecache');
   };

   apiFactory.checkjob = function() {
      return $http.get(urlBase + 'checkjob');
   };

   return apiFactory;
});

// Controller
knattleikrAdminApp.controller('knattleikrAdminController', function($scope, $window, apiFactory) {

   $scope.sessionAktiv = sessionAktiv;
   $scope.templateData = {};
   $scope.templateData.aktuellerSpieltag = aktuellerSpieltag;
   $scope.templateData.wertungsSpieltag = aktuellerSpieltag;
   $scope.templateData.joinNicknames = "";
   $scope.templateData.betreff = "";
   $scope.templateData.mailbody = "";

   $scope.jobstatus = 'wird geprüft ...';

   $scope.adminlinks = [
      {
         text: 'Spieltag festlegen',
         hash: '',
      },
      {
         text: 'Gesamtwertung',
         hash: 'gesamtwertung'
      },
      {
         text: 'Totowertung',
         hash: 'totowertung'
      },
      {
         text: 'Spieltagwertung',
         hash: 'spieltagwertung'
      },
      {
         text: 'Lieferantenwertung',
         hash: 'lieferantenwertung' 
      },
      {
         text: 'Cache invalidieren',
         hash: 'invalidatecache' 
      },
      {
         text: 'Mailjob-Status',
         hash: 'checkjob' 
      },
      {
         text: 'Mail senden',
         hash: 'sendmail'
      }
   ];

   var routeIndex = 0;
   switch($window.location.hash.substring(3)) {
      case 'gesamtwertung':
         routeIndex = 1;
         break;
      case 'totowertung':
         routeIndex = 2;
         break;
      case 'spieltagwertung':
         routeIndex = 3;
         break;
      case 'lieferantenwertung':
         routeIndex = 4;
         break;
      case 'invalidatecache':
         routeIndex = 5;
         break;
      case 'checkjob':
         routeIndex = 6;
         break;
      case 'sendmail':
         routeIndex = 7;
         break;
      default:
         routeIndex = 0;
   }
   $scope.selectedLink = $scope.adminlinks[routeIndex];

   $scope.saveConfig = function() {
      apiFactory.saveConfig({aktuellerSpieltag: $scope.templateData.aktuellerSpieltag.toString()}).then(function(response) {
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

   $scope.totowertung = function() {
      $('#spinner_totowertung').show();
      apiFactory.totowertung().then(function(response) {
         $('#spinner_totowertung').hide();
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

   $scope.spieltagwertung = function() {
      $('#spinner_spieltagwertung').show();
      apiFactory.spieltagwertung($scope.templateData.wertungsSpieltag).then(function(response) {
         $('#spinner_spieltagwertung').hide();
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

   $scope.lieferantenwertung = function() {
      $('#spinner_lieferantenwertung').show();
      apiFactory.lieferantenwertung().then(function(response) {
         $('#spinner_lieferantenwertung').hide();
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

   $scope.invalidateCache = function() {
      $('#spinner_invalidatecache').show();
      apiFactory.invalidateCache().then(function(response) {
         $('#spinner_invalidatecache').hide();
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

   $scope.checkJob = function() {
      $scope.jobstatus = 'wird geprüft ...';
      apiFactory.checkjob().then(function(response) {
         switch(response.data.err) {
            case 0:
               $scope.jobstatus = response.data.message;
               break;
            case 1:
               $scope.jobstatus = response.data.message;
               showMessage('danger', $scope.jobstatus);
               break;
            case 2:
               window.location.href = "/?err=1";
               break;
         }
      });
   };

   // Ausführen!
   $scope.checkJob();

   $scope.sendMail = function() {
      $('#spinner_sendmail').show();
      apiFactory.sendMail($scope.templateData.joinNicknames, $scope.templateData.betreff, $scope.templateData.mailbody).then(function(response) {
         $('#spinner_sendmail').hide();
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