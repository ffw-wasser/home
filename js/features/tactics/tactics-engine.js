(function(global){
  "use strict";
  const GROUP_ROLES=Object.freeze(["GF","Maschinist","ATF","ATM","WTF","WTM","STF","STM","Melder"]);
  const STAFF_REQUIRED_ROLES=Object.freeze(["GF","Maschinist","ATF","ATM","WTF","WTM"]);
  const STAFF_ROLES=STAFF_REQUIRED_ROLES;
  const MINIMUM_UNIT_ROLES=Object.freeze(["Maschinist","GF","ATF","ATM"]);

  function canDriveVehicle(member,vehicle){
    const allowed=Array.isArray(member?.machinistVehicles)?member.machinistVehicles:[];
    return vehicle==="LF10"?allowed.includes("LF"):allowed.includes("TSF")||allowed.includes("LF");
  }
  const STANDARD_CREW_ROLES=Object.freeze(["ATF","ATM","WTF","WTM"]);
  function crewRoles(roles,breathingPlanned){
    return breathingPlanned?roles:[...new Set([...roles,...STANDARD_CREW_ROLES])];
  }
  function roleScore(remaining,actual,target){return remaining*1000-actual+(target>0?100:0);}
  function compareCrewCandidates(a,b,role,vehicle){
    if(role==="Maschinist"&&vehicle==="TSF"){
      const tsfOnly=member=>canDriveVehicle(member,"TSF")&&!canDriveVehicle(member,"LF10");
      const priority=Number(tsfOnly(b.member))-Number(tsfOnly(a.member));
      if(priority)return priority;
    }
    const rank=person=>(person.preferred?.role===role?5000:0)+(person.options.find(option=>option.role===role)?.score||0);
    return rank(b)-rank(a)||a.name.localeCompare(b.name,"de");
  }
  function assignCrew(slots,people,eligible,compare,essential){
    const candidates=slots.map(slot=>people.filter(person=>eligible(person,slot)).sort((a,b)=>compare(a,b,slot)));
    const assigned=new Map(),crew=Array(slots.length).fill(null);
    function place(index,seen){
      // Keep candidates already chosen for earlier positions whenever a free
      // candidate can fill this one. Move people only to cover more positions.
      for(const person of candidates[index]){
        if(seen.has(person)||assigned.has(person))continue;
        assigned.set(person,index);
        crew[index]=person;
        return true;
      }
      for(const person of candidates[index]){
        if(seen.has(person))continue;
        seen.add(person);
        if(place(assigned.get(person),seen)){
          assigned.set(person,index);
          crew[index]=person;
          return true;
        }
      }
      return false;
    }
    const order=slots.map((_,index)=>index).sort((a,b)=>Number(essential(slots[b]))-Number(essential(slots[a])));
    for(const index of order)place(index,new Set());
    return crew;
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
  function recommendationText(sessionType,slots){
    if(sessionType==="Allgemeine Probe"&&!hasCompleteStaffelOnAnyVehicle(slots))return "Auf keinem Fahrzeug kann eine vollständige Staffel 1/5 besetzt werden. Offene Positionen bleiben unbesetzt.";
    const lf=(Array.isArray(slots)?slots:[]).filter(slot=>slot.vehicle==="LF10"&&slot.member);
    return vehicleHasMinimumUnit(lf)?"Die aktuelle Fahrzeugbesetzung ist plausibel.":"Auf dem LF10 kann keine einsatzfähige Einheit 1/3 gebildet werden. Besetzung und offene Positionen prüfen.";
  }
  const api=Object.freeze({GROUP_ROLES,STAFF_ROLES,STAFF_REQUIRED_ROLES,STANDARD_CREW_ROLES,MINIMUM_UNIT_ROLES,assignCrew,crewRoles,roleScore,compareCrewCandidates,canDriveVehicle,vehicleHasRoles,vehicleHasCompleteStaffel,hasCompleteStaffelOnAnyVehicle,vehicleHasMinimumUnit,recommendationText});
  global.TacticsEngine=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
