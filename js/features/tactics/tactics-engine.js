(function(global){
  "use strict";
  const GROUP_ROLES=Object.freeze(["GF","Maschinist","ATF","ATM","WTF","WTM","STF","STM","Melder"]);
  const STAFF_ROLES=Object.freeze(["GF","Maschinist","ATF","ATM","WTF","WTM","Melder"]);
  const STAFF_REQUIRED_ROLES=Object.freeze(["GF","Maschinist","ATF","ATM","WTF","WTM"]);
  const MINIMUM_UNIT_ROLES=Object.freeze(["Maschinist","GF","ATF","ATM"]);

  function canDriveVehicle(member,vehicle){
    const allowed=Array.isArray(member?.machinistVehicles)?member.machinistVehicles:[];
    return vehicle==="LF10"?allowed.includes("LF"):allowed.includes("TSF")||allowed.includes("LF");
  }
  function vehicleHasRoles(slots,vehicle,roles){
    const vehicleSlots=(Array.isArray(slots)?slots:[]).filter(slot=>slot.vehicle===vehicle);
    return roles.every(role=>vehicleSlots.some(slot=>slot.role===role&&Boolean(slot.member)));
  }
  function vehicleHasCompleteStaffel(slots,vehicle){return vehicleHasRoles(slots,vehicle,STAFF_REQUIRED_ROLES);}
  function hasCompleteStaffelOnAnyVehicle(slots){return vehicleHasCompleteStaffel(slots,"LF10")||vehicleHasCompleteStaffel(slots,"TSF");}
  function vehicleHasMinimumUnit(assignments){
    const list=Array.isArray(assignments)?assignments:[];
    return MINIMUM_UNIT_ROLES.every(role=>list.some(item=>item.role===role&&Boolean(item.member)));
  }
  function shouldShowAlternative(sessionType,slots){return sessionType==="Allgemeine Probe"&&!hasCompleteStaffelOnAnyVehicle(slots);}
  function recommendationText(sessionType,slots){
    if(shouldShowAlternative(sessionType,slots))return "Auf keinem Fahrzeug kann eine vollständige Staffel 1/5 besetzt werden. Als Alternative stehen Sonderprobe oder Unterricht zur Auswahl.";
    const lf=(Array.isArray(slots)?slots:[]).filter(slot=>slot.vehicle==="LF10"&&slot.member);
    return vehicleHasMinimumUnit(lf)?"Die aktuelle Fahrzeugbesetzung ist plausibel.":"Auf dem LF10 kann keine einsatzfähige Einheit 1/3 gebildet werden. Unterricht oder angepasste Ausbildung durchführen.";
  }
  const api=Object.freeze({GROUP_ROLES,STAFF_ROLES,MINIMUM_UNIT_ROLES,canDriveVehicle,vehicleHasRoles,vehicleHasCompleteStaffel,hasCompleteStaffelOnAnyVehicle,vehicleHasMinimumUnit,shouldShowAlternative,recommendationText});
  global.TacticsEngine=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
