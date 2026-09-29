/*
 * CSV-Hilfsfunktionen für Terminpakete.
 * Der frühere direkte CSV-/PDF-Export wurde entfernt. Der Terminabschluss
 * wird ausschließlich in zip-terminpakete.js ausgeführt und speichert genau
 * eine ZIP-Datei nach außen.
 */
function csvRoleForEntry(entry, member) {
  if (entry.role === "Orga") return "Orga";
  if (entry.tacticsRoleLabel) return entry.tacticsRoleLabel;
  if (entry.role !== "Maschinist") return entry.role || "";
  const vehicles = Array.isArray(member.machinistVehicles)
    ? member.machinistVehicles.filter(value => value === "LF" || value === "TSF")
    : [];
  return vehicles.length ? `Maschinist ${vehicles.join("/")}` : "Maschinist";
}
function csvCell(value) { return CsvEngine.cell(value); }
