/* Official inclusive periods, checked 2026-10-23. No local movable days. */
(function(g){
 'use strict';
 const periods=[
 ['Weihnachtsferien','2025-12-22','2026-01-05'],['Osterferien','2026-03-30','2026-04-11'],['Pfingstferien','2026-05-26','2026-06-05'],
 ['Sommerferien','2026-07-30','2026-09-12'],['Herbstferien','2026-10-26','2026-10-30'],['Weihnachtsferien','2026-12-23','2027-01-09'],
 ['Osterferien','2027-03-30','2027-04-03'],['Pfingstferien','2027-05-18','2027-05-29'],['Sommerferien','2027-07-29','2027-09-11'],['Herbstferien','2027-11-02','2027-11-06'],['Weihnachtsferien','2027-12-23','2028-01-08'],
 ['Osterferien','2028-04-18','2028-04-22'],['Pfingstferien','2028-06-06','2028-06-17'],['Sommerferien','2028-07-27','2028-09-09'],['Herbstferien','2028-10-30','2028-11-03'],['Weihnachtsferien','2028-12-23','2029-01-05'],
 ['Osterferien','2029-03-26','2029-04-07'],['Pfingstferien','2029-05-22','2029-06-01'],['Sommerferien','2029-07-26','2029-09-08'],['Herbstferien','2029-10-29','2029-11-02'],['Weihnachtsferien','2029-12-22','2030-01-05']
 ].map(([name,start,end])=>({name,start,end}));
 g.SchoolHolidays={periods,complete:year=>year>=2026&&year<=2029,forDay:day=>periods.filter(p=>p.start<=day&&p.end>=day),source:'https://km.baden-wuerttemberg.de/de/service/ferien',checked:'2026-10-23'};
})(globalThis);
