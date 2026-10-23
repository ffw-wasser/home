/* Statutory Baden-Württemberg holidays, checked against the Interior Ministry.
 * https://im.baden-wuerttemberg.de/de/service/feiertage (2026-10-23)
 * Gregorian Easter calculation, valid throughout the UI's 2000–2100 range. */
(function(g){
 'use strict';const cache=new Map(),source='https://im.baden-wuerttemberg.de/de/service/feiertage';
 function forYear(year){
  if(!Number.isInteger(year)||year<2000||year>2100)return [];
  if(cache.has(year))return cache.get(year);
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),h=(19*a+b-d-Math.floor((b-f+1)/3)+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;
  const easter=Date.UTC(year,Math.floor(n/31)-1,n%31+1),result=[];
  const add=(date,name)=>result.push({date,name});
  for(const [day,name] of [['01-01','Neujahr'],['01-06','Heilige Drei Könige'],['05-01','Tag der Arbeit'],['10-03','Tag der Deutschen Einheit'],['11-01','Allerheiligen'],['12-25','1. Weihnachtsfeiertag'],['12-26','2. Weihnachtsfeiertag']])add(year+'-'+day,name);
  for(const [offset,name] of [[-2,'Karfreitag'],[1,'Ostermontag'],[39,'Christi Himmelfahrt'],[50,'Pfingstmontag'],[60,'Fronleichnam']])add(new Date(easter+offset*86400000).toISOString().slice(0,10),name);
  result.sort((a,b)=>a.date.localeCompare(b.date));for(const item of result)Object.freeze(item);Object.freeze(result);cache.set(year,result);if(cache.size>3)cache.delete(cache.keys().next().value);return result;
 }
 g.PublicHolidays={forYear,forDay:day=>forYear(Number(String(day).slice(0,4))).filter(p=>p.date===day),source};
})(globalThis);
