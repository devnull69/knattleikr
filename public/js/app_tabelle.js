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

   $scope.showGauge = function(username, pkt, spiele, pkt1, spiele1, maxpkt) {

      $('#gauge').css("height: 500px");

      // Container leeren
      $('#gauge').html("");

      var names = ['9', '8', '7', '6', '5', '4', '3', 'Total'];

      // dataset erstellen für die Grafik
      var data = [];
      for(i=9; i>2; i--) {
         var wertung1 = (pkt1+i)/(spiele1+9);
         var distanz = 0;
         var wertung = (pkt+i+distanz)/(spiele+9);
         while(wertung < wertung1) {
            distanz++;
            wertung = (pkt+i+distanz)/(spiele+9);
         }
         data.push(distanz);
      }
      data.push(maxpkt);  // Referenzwert = die höchste derzeitige Gesamtpunktzahl

      var dataSet = anychart.data.set(data);
      var view = dataSet.mapAs();
      var palette = anychart.palettes.distinctColors().items(['#1976d2', '#1976d2', '#1976d2', '#0c5aa8', '#1976d2', '#1976d2', '#1976d2', '#1976d2']);

         var makeBarWithBar = function (gauge, radius, i, width, without_stroke) {
             var stroke = '1 #000000';
             if (without_stroke) {
                 stroke = null;
                 gauge.label(i)
                         .text(names[i] + ' Pkt. -> <span style="color: white">' + ((9-i)+data[i]) + '</span> Pkt.')// color: #7c868e
                         .useHtml(true);
                 gauge.label(i)
                         .hAlign('center')
                         .vAlign('middle')
                         .anchor('rightCenter')
                         .padding(0, 10)
                         .height(width / 2 + '%')
                         .offsetY(radius + '%')
                         .offsetX(0);
             }

             // Auf Null setzen vor Animation
             view.set(i, "value", 0);

             gauge.bar(i).dataIndex(i).radius(radius).width(width).fill(palette.itemAt(i)).stroke(stroke).zIndex(5);
             gauge.bar(i+100).dataIndex(7).radius(radius).width(width).fill('#aaaaaa').stroke(false).zIndex(4);

             // Dataset animation
             var animationDauer = 0.8;
             var frameRate = 18;
             var stepCount = animationDauer * frameRate;
             var stepSize = data[i]/stepCount;
             var step = 0;
             var currentData = 0;
             var animation = window.setInterval(function() {
               step++;
               if(step <= stepCount) {
                  currentData += stepSize;
                  view.set(i, "value", currentData);
               } else {
                  window.clearInterval(animation);
                  view.set(i, "value", data[i]);
               }
             }, 1000/frameRate);

             return gauge.bar(i);
         };

       var gauge = anychart.gauges.circular();
       gauge.data(dataSet);
       gauge.fill('#181818')
               .stroke(null)
               .padding(20)
               .margin(100)
               .startAngle(0)
               .sweepAngle(270);
       var axis = gauge.axis().radius(108).width(1).fill(null);
       axis.scale()
               .minimum(0)
               .maximum(data[data.length-1])
               .ticks({interval: 2})
               .minorTicks({interval: 1});
     
       var labels = axis.labels();
       labels.position('o');
       labels.enabled(true);

       axis.ticks().enabled(true);
       axis.minorTicks().enabled(false);
       
       gauge.margin(0);
       
       makeBarWithBar(gauge, 100, 0, 12, true);
       makeBarWithBar(gauge, 85, 1, 12, true);
       makeBarWithBar(gauge, 70, 2, 12, true);
       makeBarWithBar(gauge, 55, 3, 12, true);
       makeBarWithBar(gauge, 40, 4, 12, true);
       makeBarWithBar(gauge, 25, 5, 12, true);
       makeBarWithBar(gauge, 10, 6, 12, true);
       
       gauge.title(true);
       gauge.title().text('Distanz zu Platz 1 von ' + username).useHtml(true);
       gauge.title()
               .hAlign('center')
               .padding(0)
               .margin([0, 0, 20, 0]);

       gauge.background().fill('#181818');

       gauge.container('gauge');
       gauge.draw();
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
