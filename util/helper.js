module.exports = {
   calcPunkte : function(erg1, erg2, tipp1, tipp2) {
      var punkte = 0;
      if(erg1 === erg2) {              // Unentschieden
         if(tipp1 === tipp2) {
            punkte = 1;
            if(tipp1 === erg1)
               punkte =2;
         }
      } else if (erg1 > erg2) {        // Heimsieg
         if(tipp1 > tipp2) {
            punkte = 1;
            if(tipp1 === erg1 && tipp2 === erg2)
               punkte = 2;
         }
      } else if (erg1 < erg2) {        // Auswärtssieg
         if(tipp1 < tipp2) {
            punkte = 1;
            if(tipp1 === erg1 && tipp2 === erg2)
               punkte = 2;
         }
      }
      return punkte;
   }
};