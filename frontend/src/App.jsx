import { useEffect, useMemo, useState } from "react";
import { parseStaffelSchedule } from "/src/utils/staffelParser.js";

// const API_BASE = (import.meta.env.VITE_API_BASE_URL || "https://hofele-contract-api.azurewebsites.net").replace(/\/$/, "");
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:7071").replace(/\/$/, "");
const TEMPLATE_OPTION = {
  value: "base_contract.docx",
  label: "Standardvorlage (base_contract.docx)",
};

const ChevronRight = () => <span>→</span>;
const ChevronLeft = () => <span>←</span>;
const Check = () => <span>✓</span>;
const FileText = () => <span>📄</span>;
const UploadIcon = () => <span>📤</span>;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s().-]{6,}$/;
const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

const isValidEmail = (value = "") => EMAIL_REGEX.test(value.trim());
const isValidPhone = (value = "") => {
  const trimmed = value.trim();
  if (!PHONE_REGEX.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 6;
};
const isValidIban = (value = "") => {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  return IBAN_REGEX.test(compact);
};
const isPositiveNumber = (value) => {
  const num = parseFloat(value);
  return Number.isFinite(num) && num > 0;
};
const isNonNegativeNumber = (value) => {
  const num = parseFloat(value);
  return Number.isFinite(num) && num >= 0;
};
const isDateAfter = (start, end) => {
  if (!start || !end) return true;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
    return true;
  return endDate > startDate;
};

const normalizeMaskAKeys = (data = {}) => {
  const normalized = { ...data };

  if ("vollmacht" in normalized && !("vollmacht_vorhanden" in normalized)) {
    normalized.vollmacht_vorhanden = normalized.vollmacht;
  }

  if ("gegenpartei" in normalized && !("gegenpartei_bekannt" in normalized)) {
    normalized.gegenpartei_bekannt = normalized.gegenpartei;
  }

  return normalized;
};

const normalizeMaskBKeys = (data = {}) => {
  const normalized = { ...data };
  const toBoolean = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      return ["ja", "yes", "true", "1"].includes(value.toLowerCase());
    }
    return Boolean(value);
  };
  const setIfMissing = (key, value) => {
    if (!(key in normalized)) {
      normalized[key] = value;
    }
  };

  if (normalized.indexmiete_557b && !("indexmiete" in normalized)) {
    normalized.indexmiete = normalized.indexmiete_557b;
  }

  if (normalized.mietanpassung && !("mietanpassung_normalfall" in normalized)) {
    normalized.mietanpassung_normalfall = normalized.mietanpassung;
  }

  if (normalized.bk_zusatz_positionen && !("zusatz_bk" in normalized)) {
    normalized.zusatz_bk = Array.isArray(normalized.bk_zusatz_positionen)
      ? normalized.bk_zusatz_positionen
      : String(normalized.bk_zusatz_positionen)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  }

  if (normalized.untervermietung_klausel && !("unterverm_klausel" in normalized)) {
    normalized.unterverm_klausel = normalized.untervermietung_klausel;
  }

  if (normalized.tierhaltung_ton && !("tiere_ton" in normalized)) {
    normalized.tiere_ton = normalized.tierhaltung_ton;
  }

  if (normalized.weg_verweis_schluessel && !("weg_text" in normalized)) {
    normalized.weg_text = normalized.weg_verweis_schluessel;
  }

  const mpbGrundMap = {
    mpb_grund_vormiete: "mpb_vormiete",
    mpb_grund_modernisierung: "mpb_modern",
    mpb_grund_erstmiete: "mpb_erstmiete",
  };

  Object.entries(mpbGrundMap).forEach(([legacyKey, newKey]) => {
    if (legacyKey in normalized) {
      setIfMissing(newKey, toBoolean(normalized[legacyKey]));
    }
  });

  const mpbDetailsMap = {
    mpb_vormiete_details: "mpb_vormiete_text",
    mpb_modern_details: "mpb_modern_text",
    mpb_erstmiete_details: "mpb_erstmiete_text",
  };

  Object.entries(mpbDetailsMap).forEach(([legacyKey, newKey]) => {
    if (legacyKey in normalized) {
      setIfMissing(newKey, normalized[legacyKey]);
    }
  });

  if (normalized.mpb_vormiete_text && !("mpb_vormiete_betrag" in normalized)) {
    normalized.mpb_vormiete_betrag = normalized.mpb_vormiete_text;
  }

  if (normalized.sr_ausgleich_option === "zuschuss") {
    setIfMissing("sr_zuschuss", true);
    if (normalized.sr_ausgleich_betrag) {
      setIfMissing("sr_zuschuss_betrag", normalized.sr_ausgleich_betrag);
    }
  }

  if (normalized.sr_ausgleich_option === "mietfrei") {
    setIfMissing("sr_mietfrei", true);
    if (normalized.sr_ausgleich_monate) {
      setIfMissing("sr_mietfrei_monate", normalized.sr_ausgleich_monate);
    }
  }

  if (normalized.endrueckgabe && !("endrueckgabe_regel" in normalized)) {
    normalized.endrueckgabe_regel = normalized.endrueckgabe;
  }

  if (normalized.endrueckgabe_regel && !("endrueckgabe" in normalized)) {
    normalized.endrueckgabe = normalized.endrueckgabe_regel;
  }

  if (Array.isArray(normalized.endarbeiten_liste)) {
    normalized.endarbeiten_liste = normalized.endarbeiten_liste
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join("\n");
  }

  return normalized;
};

const parseEndarbeitenList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (!value) return [];
  return String(value)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
};

const formatEndarbeitenList = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("\n");
  }
  return value || "";
};

const createMaskADefaults = () => ({
  rolle: "",
  eigene_name: "",
  eigene_anschrift: "",
  eigene_email: "",
  eigene_telefon: "",
  eigene_iban: "",
  wird_vertreten: "",
  vertreten_durch: "",
  vollmacht_vorhanden: "",
  ust_id: "",
  steuernummer: "",
  gegenpartei_bekannt: "",
  gegenpartei_name: "",
  gegenpartei_anschrift: "",
  gegenpartei_email: "",
  gegenpartei_telefon: "",
  objektadresse: "",
  wohnung_bez: "",
  wohnungsart: "",
  wohnflaeche: "",
  bezugsfertig: "",
  aussenbereich: [],
  nebenraeume: [],
  stellplatz: "",
  stellplatz_nr: "",
  ausstattung: "",
  weg: "",
  mea: "",
  grundriss_datei: "",
  weg_dokument: "",
  zustand: "",
  uebergabeprotokoll: null,
  laerm: "",
  schluessel_arten: [],
  schluessel_anzahl: "",
  mietbeginn: "",
  mietende: "",
  vertragsart: "",
  befristungsgrund: "",
  befristungsgrund_text: "",
  grundmiete: "",
  zuschlag_moeblierung: "",
  zuschlag_teilgewerbe: "",
  zuschlag_unterverm: "",
  vz_heizung: "",
  vz_bk: "",
  stellplatzmiete: "",
  zahlungsart: "",
  zahler_iban: "",
  bk_modell: "",
  bk_weg: "",
  abrz: "",
  nutzung: "",
  unterverm: "",
  tiere: "",
  tiere_details: "",
  kaution: "",
  kautionsform: "",
  uebergabedatum: "",
});

const createMaskBDefaults = () => ({
  ro_rolle: "",
  ro_name: "",
  ro_email: "",
  ro_telefon: "",
  ro_objektadresse: "",
  ro_wohneinheit: "",
  ro_bezugsfertig: "",
  ro_mietbeginn: "",
  ro_grundmiete: "",
  ro_gesamtmiete: "",
  ro_vz_heizung: "",
  vertragsart_final: "",
  kuendigungsverzicht: "",
  indexmiete: "",
  staffelmiete: "",
  staffelmiete_schedule: "",
  faelligkeit: "",
  mietanpassung_normalfall: "",
  mpb_status: "",
  mpb_vormiet: "",
  mpb_grenze: "",
  mpb_vormiete: false,
  mpb_vormiete_betrag: "",
  mpb_vormiete_text: "",
  mpb_modern: false,
  mpb_modern_text: "",
  mpb_erstmiete: false,
  mpb_erstmiete_text: "",
  zusatz_bk: [],
  weg_text: "",
  heizww_paragraph: "",
  unterverm_klausel: "",
  tiere_ton: "",
  bauveraenderung: false,
  besichtigung: false,
  heiz_separat: false,
  sr_renoviert: false,
  sr_unrenoviert_ohne: false,
  sr_unrenoviert_mit: false,
  sr_ausgleich_option: "",
  sr_ausgleich_betrag: "",
  sr_ausgleich_monate: "",
  sr_zuschuss: false,
  sr_zuschuss_betrag: "",
  sr_mietfrei: false,
  sr_mietfrei_monate: "",
  sr_risiko: false,
  kleinrep_je: "",
  kleinrep_jahr: "",
  korrektur: "",
  endrueckgabe_regel: "",
  endarbeiten_liste: "",
  endrueckgabe: "",
  haftung_536a: "",
  umgebung_laerm: "",
  aufrechnung: "",
  veraeusserung: "",
  energie_einbindung: "",
  dsgvo: "",
  anlagen: [],
  bearbeitungsdatum: "",
  bearbeiter: "",
  mieter_email: "",
  mieter_telefon: "",
});

const exportFinalJSONHelper = async ({
  mandantendaten,
  formData,
  validateAll,
  setApiError,
  setDownloadUrl,
  setIsGenerating,
  apiBase,
  templatePath,
  createMaskADefaults,
  createMaskBDefaults,
  normalizeMaskAKeys,
  normalizeMaskBKeys,
  parseEndarbeitenList,
  parseStaffelSchedule,
  buildPlaceholderMapping,
}) => {
  if (!mandantendaten) {
    alert("Es wurden keine Mandantendaten geladen.");
    return;
  }

  if (!validateAll()) {
    return;
  }

  setApiError("");
  setDownloadUrl("");
  setIsGenerating(true);

  // Normalize mask payloads so downstream mapping uses consistent keys.
  const normalizedMaskA = {
    ...createMaskADefaults(),
    ...normalizeMaskAKeys(mandantendaten),
  };
  const rawMaskB = {
    ...createMaskBDefaults(),
    ...normalizeMaskBKeys(formData),
  };

  const normalizedMaskB = {
    ...rawMaskB,
    endrueckgabe: rawMaskB.endrueckgabe_regel || rawMaskB.endrueckgabe,
    endarbeiten_liste: parseEndarbeitenList(rawMaskB.endarbeiten_liste),
    staffelmiete_schedule:
      rawMaskB.mietanpassung_model === "STAFFEL"
        ? parseStaffelSchedule(rawMaskB.staffelmiete_schedule)
        : [],
  };
  // Assemble placeholder mappings to drive template substitutions.
  const placeholderMapping = buildPlaceholderMapping(
    normalizedMaskA,
    normalizedMaskB
  );

  try {
    // Build and send the generation request with normalized data and placeholders.
    const res = await fetch(`${apiBase}/api/generate_contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        maskA: normalizedMaskA,
        maskB: normalizedMaskB,
        templatePath,
        placeholderMapping,
      }),
    });

    // Handle response outcomes to surface errors or download links.
    if (!res.ok) {
      const text = await res.text();
      console.error("Fehler bei der Vertragserstellung:", text);
      setApiError(
        "Der Vertrag konnte nicht erstellt werden. Bitte später erneut versuchen."
      );
      alert(
        "Der Vertrag konnte nicht erstellt werden. Bitte später erneut versuchen."
      );
      return;
    }

    const data = await res.json();
    if (data.downloadUrl) {
      const apiBaseUrl = new URL(apiBase, window.location.origin);
      const absoluteDownloadUrl = new URL(
        data.downloadUrl,
        apiBaseUrl
      ).toString();
      setDownloadUrl(absoluteDownloadUrl);
    } else {
      setApiError("Die Antwort des Servers enthält keinen Download-Link.");
    }
  } catch (e) {
    console.error("Fehler bei der Kommunikation mit Azure:", e);
    setApiError(
      "Es ist ein Verbindungsfehler aufgetreten. Bitte prüfen Sie die Server-Konfiguration."
    );
  } finally {
    setIsGenerating(false);
  }
};


/**********************
 * MANDANTENMASKE (MASK A)
 **********************/
function MandantenMaske() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(createMaskADefaults);
  const [errors, setErrors] = useState({});

  const steps = [
    "Rolle & Kontakt",
    "Mietobjekt",
    "Zustand & Schlüssel",
    "Mietzeit",
    "Miete & Kosten",
    "Nutzung & Tiere",
    "Kaution & Übergabe",
    "Zusammenfassung",
  ];

  const stepDescriptions = [
    "Rolle, Kontakt und Gegenpartei",
    "Adresse, Ausstattung und WEG",
    "Zustand bei Übergabe",
    "Mietbeginn und Vertragsart",
    "Miete, Zuschläge und BK",
    "Nutzung, Untervermietung, Tiere",
    "Kaution und Zahlungsform",
    "Abschließende Kontrolle",
  ];

  const updateFormData = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const clone = { ...prev };
        delete clone[field];
        return clone;
      });
    }
  };

  const toggleSelection = (field, value) => {
    setFormData((prev) => {
      const current = prev[field] || [];
      const exists = current.includes(value);
      const next = exists
        ? current.filter((item) => item !== value)
        : [...current, value];
      return { ...prev, [field]: next };
    });
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value || "0");
    if (Number.isNaN(num)) return "0,00 EUR";
    return `${num.toFixed(2).replace(".", ",")} EUR`;
  };

  const calculateTotalRent = () => {
    const toNumber = (val) => parseFloat(val || "0") || 0;
    const total =
      toNumber(formData.grundmiete) +
      toNumber(formData.zuschlag_moeblierung) +
      toNumber(formData.zuschlag_teilgewerbe) +
      toNumber(formData.zuschlag_unterverm) +
      toNumber(formData.vz_heizung) +
      toNumber(formData.vz_bk) +
      toNumber(formData.stellplatzmiete);
    return formatCurrency(total);
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 0) {
      if (!formData.rolle)
        newErrors.rolle = "Bitte wählen Sie Ihre Rolle.";
      if (!formData.eigene_name)
        newErrors.eigene_name = "Name ist erforderlich.";
      if (!formData.eigene_anschrift)
        newErrors.eigene_anschrift = "Anschrift ist erforderlich.";
      if (!formData.eigene_email)
        newErrors.eigene_email = "E-Mail ist erforderlich.";
      if (formData.eigene_email && !isValidEmail(formData.eigene_email))
        newErrors.eigene_email = "Bitte geben Sie eine gültige E-Mail an.";
      if (!formData.eigene_telefon)
        newErrors.eigene_telefon = "Telefon ist erforderlich.";
      if (formData.eigene_telefon && !isValidPhone(formData.eigene_telefon))
        newErrors.eigene_telefon = "Bitte geben Sie eine gültige Telefonnummer an.";
      if (!formData.eigene_iban)
        newErrors.eigene_iban = "IBAN ist erforderlich.";
      if (formData.eigene_iban && !isValidIban(formData.eigene_iban))
        newErrors.eigene_iban = "Bitte geben Sie eine gültige IBAN an.";
      if (formData.wird_vertreten === "ja" && !formData.vertreten_durch)
        newErrors.vertreten_durch = "Bitte benennen Sie den Vertreter.";
      if (formData.wird_vertreten === "ja" && !formData.vollmacht_vorhanden)
        newErrors.vollmacht_vorhanden =
          "Bitte wählen Sie eine Option zur Vollmacht.";
      if (!formData.gegenpartei_bekannt)
        newErrors.gegenpartei_bekannt =
          "Bitte wählen Sie, ob die Gegenpartei bekannt ist.";
      if (formData.gegenpartei_bekannt === "ja") {
        if (!formData.gegenpartei_name)
          newErrors.gegenpartei_name = "Name der Gegenpartei ist erforderlich.";
        if (!formData.gegenpartei_anschrift)
          newErrors.gegenpartei_anschrift = "Bitte geben Sie die Anschrift an.";
        if (!formData.gegenpartei_email)
          newErrors.gegenpartei_email = "Bitte geben Sie eine E-Mail an.";
        if (
          formData.gegenpartei_email &&
          !isValidEmail(formData.gegenpartei_email)
        )
          newErrors.gegenpartei_email =
            "Bitte geben Sie eine gültige E-Mail an.";
        if (
          formData.gegenpartei_telefon &&
          !isValidPhone(formData.gegenpartei_telefon)
        )
          newErrors.gegenpartei_telefon =
            "Bitte geben Sie eine gültige Telefonnummer an.";
      }
    }

    if (step === 1) {
      if (!formData.objektadresse)
        newErrors.objektadresse = "Objektadresse ist erforderlich.";
      if (!formData.wohnungsart)
        newErrors.wohnungsart = "Bitte wählen Sie die Wohnungsart.";
      if (!formData.wohnflaeche)
        newErrors.wohnflaeche = "Wohnfläche ist erforderlich.";
      if (formData.wohnflaeche && !isPositiveNumber(formData.wohnflaeche))
        newErrors.wohnflaeche = "Bitte geben Sie eine gültige Wohnfläche an.";
      if (!formData.bezugsfertig)
        newErrors.bezugsfertig = "Bitte wählen Sie das Bezugsfertig-Datum.";
      if (!formData.weg)
        newErrors.weg = "Bitte wählen Sie eine Option zur WEG.";
      if (formData.mea && !isPositiveNumber(formData.mea))
        newErrors.mea = "Bitte geben Sie einen gültigen Miteigentumsanteil an.";
    }

    if (step === 2) {
      if (!formData.zustand)
        newErrors.zustand = "Bitte wählen Sie den Zustand.";
      if (formData.uebergabeprotokoll === null)
        newErrors.uebergabeprotokoll =
          "Bitte wählen Sie, ob ein Übergabeprotokoll geführt wird.";
      if (!formData.laerm)
        newErrors.laerm = "Bitte wählen Sie die Lärmquelle aus.";
      if (!formData.schluessel_arten?.length)
        newErrors.schluessel_arten =
          "Bitte wählen Sie mindestens eine Schlüsselart aus.";
      if (!formData.schluessel_anzahl)
        newErrors.schluessel_anzahl = "Bitte geben Sie die Schlüsselanzahl an.";
      if (
        formData.schluessel_anzahl &&
        !isPositiveNumber(formData.schluessel_anzahl)
      )
        newErrors.schluessel_anzahl =
          "Bitte geben Sie eine gültige Schlüsselanzahl an.";
    }

    if (step === 3) {
      if (!formData.mietbeginn)
        newErrors.mietbeginn = "Mietbeginn ist erforderlich.";
      if (!formData.vertragsart)
        newErrors.vertragsart = "Bitte wählen Sie die Vertragsart.";
      if (formData.vertragsart === "Befristet") {
        if (!formData.mietende)
          newErrors.mietende = "Bitte geben Sie das Mietende an.";
        if (
          formData.mietbeginn &&
          formData.mietende &&
          !isDateAfter(formData.mietbeginn, formData.mietende)
        )
          newErrors.mietende = "Das Mietende muss nach dem Mietbeginn liegen.";
        if (!formData.befristungsgrund)
          newErrors.befristungsgrund = "Bitte wählen Sie den Befristungsgrund.";
        if (!formData.befristungsgrund_text)
          newErrors.befristungsgrund_text =
            "Bitte begründen Sie die Befristung.";
      }
    }

    if (step === 4) {
      if (
        formData.grundmiete === "" ||
        formData.grundmiete === null ||
        formData.grundmiete === undefined
      )
        newErrors.grundmiete = "Grundmiete ist erforderlich.";
      if (
        formData.grundmiete !== "" &&
        formData.grundmiete !== null &&
        formData.grundmiete !== undefined &&
        !isNonNegativeNumber(formData.grundmiete)
      )
        newErrors.grundmiete = "Bitte geben Sie eine gültige Grundmiete an.";
      if (!formData.zahlungsart)
        newErrors.zahlungsart = "Bitte wählen Sie die Zahlungsart.";
      if (!formData.bk_modell)
        newErrors.bk_modell = "Bitte wählen Sie das Betriebskostenmodell.";
      if (!formData.bk_weg)
        newErrors.bk_weg = "Bitte wählen Sie eine Option zur BK-Umlage.";
      if (formData.vz_heizung && !isNonNegativeNumber(formData.vz_heizung))
        newErrors.vz_heizung = "Bitte geben Sie einen gültigen Betrag an.";
      if (formData.vz_bk && !isNonNegativeNumber(formData.vz_bk))
        newErrors.vz_bk = "Bitte geben Sie einen gültigen Betrag an.";
      if (
        formData.zuschlag_moeblierung &&
        !isNonNegativeNumber(formData.zuschlag_moeblierung)
      )
        newErrors.zuschlag_moeblierung = "Bitte geben Sie einen gültigen Betrag an.";
      if (
        formData.zuschlag_teilgewerbe &&
        !isNonNegativeNumber(formData.zuschlag_teilgewerbe)
      )
        newErrors.zuschlag_teilgewerbe = "Bitte geben Sie einen gültigen Betrag an.";
      if (
        formData.zuschlag_unterverm &&
        !isNonNegativeNumber(formData.zuschlag_unterverm)
      )
        newErrors.zuschlag_unterverm = "Bitte geben Sie einen gültigen Betrag an.";
      if (
        formData.stellplatzmiete &&
        !isNonNegativeNumber(formData.stellplatzmiete)
      )
        newErrors.stellplatzmiete = "Bitte geben Sie einen gültigen Betrag an.";
      if (formData.zahler_iban && !isValidIban(formData.zahler_iban))
        newErrors.zahler_iban = "Bitte geben Sie eine gültige IBAN an.";
    }

    if (step === 5) {
      if (!formData.nutzung)
        newErrors.nutzung = "Bitte wählen Sie die Nutzung.";
      if (!formData.unterverm)
        newErrors.unterverm = "Bitte geben Sie eine Angabe zur Untervermietung an.";
      if (!formData.tiere)
        newErrors.tiere = "Bitte wählen Sie eine Option zur Tierhaltung.";
      if (
        formData.tiere === "sondervereinbarung" &&
        !formData.tiere_details
      ) {
        newErrors.tiere_details = "Bitte beschreiben Sie die Sondervereinbarung.";
      }
    }

    if (step === 6) {
      if (!formData.kaution)
        newErrors.kaution = "Bitte geben Sie die Kautionshöhe an.";
      if (!formData.kautionsform)
        newErrors.kautionsform = "Bitte wählen Sie die Kautionsform.";
      if (!formData.uebergabedatum)
        newErrors.uebergabedatum = "Bitte wählen Sie das Übergabedatum.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const exportJSON = async () => {
    if (!validateStep(currentStep)) return;
    const output = {
      ...createMaskADefaults(),
      ...normalizeMaskAKeys(formData),
      timestamp: new Date().toISOString(),
    };

    try {
      await fetch(`${API_BASE}/api/save_mask_a`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(output),
      });
    } catch (e) {
      console.error("Fehler beim Senden an Azure:", e);
      alert(
        "Die Daten konnten nicht an den Server gesendet werden. Die JSON-Datei wird trotzdem lokal gespeichert."
      );
    }

    const blob = new Blob([JSON.stringify(output, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mandantendaten_${new Date().toISOString().split("T")[0]
      }.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderStepper = () => (
    <div className="stepper-v2">
      {steps.map((title, index) => {
        const isActive = index === currentStep;
        const isDone = index < currentStep;
        return (
          <div
            key={title}
            className={`stepper-step ${isActive ? "active" : ""
              } ${isDone ? "completed" : ""}`}
          >
            <div className="stepper-icon">
              {isDone ? "✓" : index + 1}
            </div>
            <div>
              <div className="stepper-title">{title}</div>
              <div className="stepper-desc">{stepDescriptions[index]}</div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="form-section-v2">
            <h2 className="section-title-v2">Rolle & Kontaktdaten</h2>
            <p className="tagline">
              Bitte geben Sie Ihre Kontaktdaten und Informationen zur Gegenpartei
              an.
            </p>

            <div className="field-v2">
              <label>
                Ihre Rolle im Mietvertrag <span className="required">*</span>
              </label>
              <div className="radio-group-v2">
                {[
                  ["Vermieter", "Vermieter"],
                  ["Mieter", "Mieter"],
                ].map(([value, label]) => (
                  <label key={value} className="radio-option-v2">
                    <input
                      type="radio"
                      value={value}
                      checked={formData.rolle === value}
                      onChange={(e) => updateFormData("rolle", e.target.value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {errors.rolle && <div className="error-text">{errors.rolle}</div>}
            </div>

            <div className="info-box-v2">
              <strong>Ihre Angaben</strong>
            </div>

            <div className="field-v2">
              <label>
                Name / Firma <span className="required">*</span>
              </label>
              <input
                type="text"
                className={`input ${errors.eigene_name ? "error" : ""}`}
                value={formData.eigene_name}
                onChange={(e) => updateFormData("eigene_name", e.target.value)}
                placeholder="Max Mustermann bzw. Muster GmbH"
              />
              {errors.eigene_name && (
                <div className="error-text">{errors.eigene_name}</div>
              )}
            </div>

            <div className="field-v2">
              <label>
                Anschrift <span className="required">*</span>
              </label>
              <textarea
                className={`textarea ${errors.eigene_anschrift ? "error" : ""}`}
                value={formData.eigene_anschrift}
                onChange={(e) =>
                  updateFormData("eigene_anschrift", e.target.value)
                }
                placeholder="Musterstraße 1, 12345 Musterstadt"
                rows="2"
              ></textarea>
              {errors.eigene_anschrift && (
                <div className="error-text">{errors.eigene_anschrift}</div>
              )}
            </div>

            <div className="field-v2">
              <label>
                E-Mail <span className="required">*</span>
              </label>
              <input
                type="email"
                className={`input ${errors.eigene_email ? "error" : ""}`}
                value={formData.eigene_email}
                onChange={(e) => updateFormData("eigene_email", e.target.value)}
                placeholder="beispiel@email.de"
              />
              {errors.eigene_email && (
                <div className="error-text">{errors.eigene_email}</div>
              )}
            </div>

            <div className="field-v2">
              <label>
                Telefon <span className="required">*</span>
              </label>
              <input
                type="tel"
                className={`input ${errors.eigene_telefon ? "error" : ""}`}
                value={formData.eigene_telefon}
                onChange={(e) => updateFormData("eigene_telefon", e.target.value)}
                placeholder="+49 123 456789"
              />
              {errors.eigene_telefon && (
                <div className="error-text">{errors.eigene_telefon}</div>
              )}
            </div>

            <div className="field-v2">
              <label>
                IBAN (Zahlungsempfänger) <span className="required">*</span>
              </label>
              <input
                type="text"
                className={`input ${errors.eigene_iban ? "error" : ""}`}
                value={formData.eigene_iban}
                onChange={(e) => updateFormData("eigene_iban", e.target.value)}
                placeholder="DE89 3704 0044 0532 0130 00"
              />
              {errors.eigene_iban && (
                <div className="error-text">{errors.eigene_iban}</div>
              )}
            </div>

            <div className="field-v2">
              <label>Werden Sie vertreten?</label>
              <div className="radio-group-v2">
                {[
                  ["ja", "Ja"],
                  ["nein", "Nein"],
                ].map(([value, label]) => (
                  <label key={value} className="radio-option-v2">
                    <input
                      type="radio"
                      value={value}
                      checked={formData.wird_vertreten === value}
                      onChange={(e) =>
                        updateFormData("wird_vertreten", e.target.value)
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {formData.wird_vertreten === "ja" && (
              <div className="highlight-box">
                <div className="field-v2">
                  <label>
                    Vertreten durch (Name/Firma) <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className={`input ${errors.vertreten_durch ? "error" : ""}`}
                    value={formData.vertreten_durch}
                    onChange={(e) =>
                      updateFormData("vertreten_durch", e.target.value)
                    }
                    placeholder="z.B. Hausverwaltung Müller GmbH"
                  />
                  {errors.vertreten_durch && (
                    <div className="error-text">{errors.vertreten_durch}</div>
                  )}
                </div>

                <div className="field-v2">
                  <label>
                    Liegt eine Vollmacht bei? <span className="required">*</span>
                  </label>
                  <div className="radio-group-v2">
                    {[
                      ["ja", "Ja, liegt bei"],
                      ["nein", "Nein, wurde separat erteilt"],
                    ].map(([value, label]) => (
                      <label key={value} className="radio-option-v2">
                        <input
                          type="radio"
                          value={value}
                          checked={formData.vollmacht_vorhanden === value}
                          onChange={(e) =>
                            updateFormData("vollmacht_vorhanden", e.target.value)
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.vollmacht_vorhanden && (
                    <div className="error-text">{errors.vollmacht_vorhanden}</div>
                  )}
                </div>
              </div>
            )}

            <div className="field-v2">
              <label>USt-ID (optional)</label>
              <input
                type="text"
                className="input"
                value={formData.ust_id}
                onChange={(e) => updateFormData("ust_id", e.target.value)}
                placeholder="z.B. DE123456789"
              />
            </div>

            <div className="field-v2">
              <label>Steuernummer (optional)</label>
              <input
                type="text"
                className="input"
                value={formData.steuernummer}
                onChange={(e) => updateFormData("steuernummer", e.target.value)}
                placeholder="z.B. 12/345/67890"
              />
            </div>

            <div className="field-v2">
              <label>
                Ist die Gegenpartei bereits bekannt? <span className="required">*</span>
              </label>
              <div className="radio-group-v2">
                {[
                  ["ja", "Ja"],
                  ["nein", "Nein"],
                ].map(([value, label]) => (
                  <label key={value} className="radio-option-v2">
                    <input
                      type="radio"
                      value={value}
                      checked={formData.gegenpartei_bekannt === value}
                      onChange={(e) =>
                        updateFormData("gegenpartei_bekannt", e.target.value)
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {errors.gegenpartei_bekannt && (
                <div className="error-text">{errors.gegenpartei_bekannt}</div>
              )}
            </div>

            {formData.gegenpartei_bekannt === "ja" && (
              <div className="info-box-v2">
                <strong>Angaben zur Gegenpartei</strong>
                <div className="field-v2" style={{ marginTop: "10px" }}>
                  <label>
                    Name / Firma <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className={`input ${errors.gegenpartei_name ? "error" : ""
                      }`}
                    value={formData.gegenpartei_name}
                    onChange={(e) =>
                      updateFormData("gegenpartei_name", e.target.value)
                    }
                    placeholder="Name der Gegenpartei"
                  />
                  {errors.gegenpartei_name && (
                    <div className="error-text">{errors.gegenpartei_name}</div>
                  )}
                </div>

                <div className="field-v2">
                  <label>
                    Anschrift <span className="required">*</span>
                  </label>
                  <textarea
                    className={`textarea ${errors.gegenpartei_anschrift ? "error" : ""
                      }`}
                    value={formData.gegenpartei_anschrift}
                    onChange={(e) =>
                      updateFormData("gegenpartei_anschrift", e.target.value)
                    }
                    rows="2"
                  ></textarea>
                  {errors.gegenpartei_anschrift && (
                    <div className="error-text">
                      {errors.gegenpartei_anschrift}
                    </div>
                  )}
                </div>

                <div className="field-v2">
                  <label>
                    E-Mail <span className="required">*</span>
                  </label>
                  <input
                    type="email"
                    className={`input ${errors.gegenpartei_email ? "error" : ""
                      }`}
                    value={formData.gegenpartei_email}
                    onChange={(e) =>
                      updateFormData("gegenpartei_email", e.target.value)
                    }
                  />
                  {errors.gegenpartei_email && (
                    <div className="error-text">{errors.gegenpartei_email}</div>
                  )}
                </div>

                <div className="field-v2">
                  <label>Telefon (optional)</label>
                  <input
                    type="tel"
                    className={`input ${errors.gegenpartei_telefon ? "error" : ""}`}
                    value={formData.gegenpartei_telefon}
                    onChange={(e) =>
                      updateFormData("gegenpartei_telefon", e.target.value)
                    }
                  />
                  {errors.gegenpartei_telefon && (
                    <div className="error-text">{errors.gegenpartei_telefon}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      case 1:
        return (
          <div className="form-section-v2">
            <h2 className="section-title-v2">Mietobjekt</h2>
            <p className="tagline">Daten zum Mietobjekt und zur Ausstattung.</p>

            <div className="field-v2">
              <label>
                Objektadresse <span className="required">*</span>
              </label>
              <textarea
                className={`textarea ${errors.objektadresse ? "error" : ""}`}
                value={formData.objektadresse}
                onChange={(e) => updateFormData("objektadresse", e.target.value)}
                placeholder="Musterstraße 42, 12345 Musterstadt"
                rows="2"
              ></textarea>
              {errors.objektadresse && (
                <div className="error-text">{errors.objektadresse}</div>
              )}
            </div>

            <div className="field-v2">
              <label>Wohnung / Bezeichnung</label>
              <input
                type="text"
                className="input"
                value={formData.wohnung_bez}
                onChange={(e) =>
                  updateFormData("wohnung_bez", e.target.value)
                }
                placeholder="z.B. WE 3.2, 2. OG links"
              />
            </div>

            <div className="field-v2">
              <label>
                Wohnungsart <span className="required">*</span>
              </label>
              <select
                className={`select ${errors.wohnungsart ? "error" : ""}`}
                value={formData.wohnungsart}
                onChange={(e) => updateFormData("wohnungsart", e.target.value)}
              >
                <option value="">Bitte wählen...</option>
                <option>Eigentumswohnung in Mehrfamilienhaus</option>
                <option>Einfamilienhaus</option>
                <option>Doppelhaushälfte</option>
                <option>Reihenhaus</option>
                <option>Einliegerwohnung</option>
                <option>Wohnung im Hochhaus</option>
                <option>Sonstiges</option>
              </select>
              {errors.wohnungsart && (
                <div className="error-text">{errors.wohnungsart}</div>
              )}
            </div>

            <div className="field-v2">
              <label>
                Wohnfläche (m²) <span className="required">*</span>
              </label>
              <input
                type="number"
                className={`input ${errors.wohnflaeche ? "error" : ""}`}
                value={formData.wohnflaeche}
                onChange={(e) => updateFormData("wohnflaeche", e.target.value)}
                placeholder="z.B. 75.5"
              />
              {errors.wohnflaeche && (
                <div className="error-text">{errors.wohnflaeche}</div>
              )}
            </div>

            <div className="highlight-box">
              <label>
                Bezugsfertig seit (Datum) <span className="required">*</span>
              </label>
              <input
                type="date"
                className={`input ${errors.bezugsfertig ? "error" : ""}`}
                value={formData.bezugsfertig}
                onChange={(e) =>
                  updateFormData("bezugsfertig", e.target.value)
                }
              />
              {errors.bezugsfertig && (
                <div className="error-text">{errors.bezugsfertig}</div>
              )}
              <p className="help-text" style={{ color: "#991b1b" }}>
                ⚠️ Wichtig: Dieses Datum ist entscheidend für die Mietpreisbremse!
              </p>
            </div>

            <div className="field-v2">
              <label>Außenbereich</label>
              <div className="checkbox-group-v2">
                {["Balkon", "Loggia", "Terrasse", "Keiner"].map(
                  (value) => (
                    <label key={value} className="checkbox-option-v2">
                      <input
                        type="checkbox"
                        checked={(formData.aussenbereich || []).includes(value)}
                        onChange={() => toggleSelection("aussenbereich", value)}
                      />
                      <span>{value}</span>
                    </label>
                  )
                )}
              </div>
            </div>

            <div className="field-v2">
              <label>Nebenräume</label>
              <div className="checkbox-group-v2">
                {[
                  "Keller",
                  "Dachboden",
                  "Abstellraum",
                  "Fahrradraum (Mitbenutzung)",
                ].map((value) => (
                  <label key={value} className="checkbox-option-v2">
                    <input
                      type="checkbox"
                      checked={(formData.nebenraeume || []).includes(value)}
                      onChange={() => toggleSelection("nebenraeume", value)}
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="field-v2">
              <label>Stellplatz</label>
              <select
                className="select"
                value={formData.stellplatz}
                onChange={(e) => updateFormData("stellplatz", e.target.value)}
              >
                <option value="">Bitte wählen...</option>
                <option>Kein Stellplatz</option>
                <option>Außenstellplatz</option>
                <option>Tiefgarage</option>
                <option>Carport</option>
              </select>
            </div>

            <div className="field-v2">
              <label>Stellplatz-Nummer (optional)</label>
              <input
                type="text"
                className="input"
                value={formData.stellplatz_nr}
                onChange={(e) =>
                  updateFormData("stellplatz_nr", e.target.value)
                }
                placeholder="z.B. TG-27"
              />
            </div>

            <div className="field-v2">
              <label>Mitvermietete Ausstattung (optional)</label>
              <input
                type="text"
                className="input"
                value={formData.ausstattung}
                onChange={(e) =>
                  updateFormData("ausstattung", e.target.value)
                }
                placeholder="z.B. Einbauküche"
              />
            </div>

            <div className="field-v2">
              <label>
                Wohnungseigentümergemeinschaft (WEG) <span className="required">*</span>
              </label>
              <div className="radio-group-v2">
                {[
                  ["ja", "Ja"],
                  ["nein", "Nein"],
                ].map(([value, label]) => (
                  <label key={value} className="radio-option-v2">
                    <input
                      type="radio"
                      value={value}
                      checked={formData.weg === value}
                      onChange={(e) => updateFormData("weg", e.target.value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {errors.weg && <div className="error-text">{errors.weg}</div>}
            </div>

            <div className="field-v2">
              <label>Miteigentumsanteile (optional)</label>
              <input
                type="number"
                className={`input ${errors.mea ? "error" : ""}`}
                value={formData.mea}
                onChange={(e) =>
                  updateFormData("mea", e.target.value)
                }
                placeholder="z.B. 125.5"
              />
              {errors.mea && <div className="error-text">{errors.mea}</div>}
            </div>

            <div className="info-box-v2">
              <strong>Dokumente hochladen</strong>
              <div className="field-v2" style={{ marginTop: "10px" }}>
                <label>Grundriss / Plan (Dateiname wird gespeichert)</label>
                <input
                  type="file"
                  className="input"
                  onChange={(e) =>
                    updateFormData(
                      "grundriss_datei",
                      e.target.files?.[0]?.name || ""
                    )
                  }
                />
              </div>
              <div className="field-v2">
                <label>Teilungserklärung / WEG-Abrechnung</label>
                <input
                  type="file"
                  className="input"
                  onChange={(e) =>
                    updateFormData(
                      "weg_dokument",
                      e.target.files?.[0]?.name || ""
                    )
                  }
                />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="form-section-v2">
            <h2 className="section-title-v2">Zustand & Schlüssel</h2>
            <p className="tagline">Zustand bei Übergabe und Schlüsselanzahl.</p>

            <div className="field-v2">
              <label>
                Zustand bei Übergabe <span className="required">*</span>
              </label>
              <select
                className={`select ${errors.zustand ? "error" : ""}`}
                value={formData.zustand}
                onChange={(e) =>
                  updateFormData("zustand", e.target.value)
                }
              >
                <option value="">Bitte wählen...</option>
                <option value="renoviert">Renoviert</option>
                <option value="neu erstellt">Teilsaniert</option>
                <option value="gebraucht/vertragsgemäß">Unrenoviert</option>
              </select>
              {errors.zustand && (
                <div className="error-text">{errors.zustand}</div>
              )}
            </div>

            <div className="field-v2">
              <label>
                Übergabeprotokoll <span className="required">*</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.uebergabeprotokoll === true}
                  onChange={(e) =>
                    updateFormData("uebergabeprotokoll", e.target.checked)
                  }
                />
                <span>Ja, Protokoll wird bei Übergabe geführt</span>
              </label>
              {errors.uebergabeprotokoll && (
                <div className="error-text">{errors.uebergabeprotokoll}</div>
              )}
            </div>

            <div className="field-v2">
              <label>
                Umgebungslärm / Besonderheiten <span className="required">*</span>
              </label>
              <select
                className={`select ${errors.laerm ? "error" : ""}`}
                value={formData.laerm}
                onChange={(e) => updateFormData("laerm", e.target.value)}
              >
                <option value="">Bitte wählen...</option>
                <option>keine besonderen Lärmquellen</option>
                <option>Straßen- / Verkehrslärm</option>
                <option>Fluglärm</option>
                <option>Bahn- / Tramverkehr</option>
                <option>Gastronomie / Clubbetrieb</option>
                <option>Sonstige Hinweise</option>
              </select>
              {errors.laerm && <div className="error-text">{errors.laerm}</div>}
            </div>

            <div className="field-v2">
              <label>
                Schlüsselarten <span className="required">*</span>
              </label>
              <div className="checkbox-group-v2">
                {["Wohnungsschlüssel", "Haustür", "Keller", "Briefkasten", "Tiefgarage / Stellplatz"].map(
                  (option) => (
                    <label key={option} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.schluessel_arten.includes(option)}
                        onChange={() => toggleSelection("schluessel_arten", option)}
                      />
                      <span>{option}</span>
                    </label>
                  )
                )}
              </div>
              {errors.schluessel_arten && (
                <div className="error-text">{errors.schluessel_arten}</div>
              )}
            </div>

            <div className="field-v2">
              <label>
                Gesamtanzahl Schlüssel <span className="required">*</span>
              </label>
              <input
                type="number"
                className={`input ${errors.schluessel_anzahl ? "error" : ""}`}
                value={formData.schluessel_anzahl}
                onChange={(e) =>
                  updateFormData("schluessel_anzahl", e.target.value)
                }
              />
              {errors.schluessel_anzahl && (
                <div className="error-text">{errors.schluessel_anzahl}</div>
              )}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="form-section-v2">
            <h2 className="section-title-v2">Mietzeit</h2>
            <p className="tagline">Angaben zu Mietbeginn und Vertragsart.</p>

            <div className="field-v2">
              <label>
                Mietbeginn <span className="required">*</span>
              </label>
              <input
                type="date"
                className={`input ${errors.mietbeginn ? "error" : ""}`}
                value={formData.mietbeginn}
                onChange={(e) => updateFormData("mietbeginn", e.target.value)}
              />
              {errors.mietbeginn && (
                <div className="error-text">{errors.mietbeginn}</div>
              )}
            </div>

            <div className="field-v2">
              <label>
                Vertragsart <span className="required">*</span>
              </label>
              <select
                className={`select ${errors.vertragsart ? "error" : ""}`}
                value={formData.vertragsart}
                onChange={(e) => updateFormData("vertragsart", e.target.value)}
              >
                <option value="">Bitte wählen...</option>
                <option>Unbefristet</option>
                <option>Befristet</option>
                <option>Staffelmiete</option>
              </select>
              {errors.vertragsart && (
                <div className="error-text">{errors.vertragsart}</div>
              )}
            </div>

            {formData.vertragsart === "Befristet" && (
              <div className="highlight-box">
                <div className="field-v2">
                  <label>
                    Mietende <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    className={`input ${errors.mietende ? "error" : ""}`}
                    value={formData.mietende}
                    onChange={(e) => updateFormData("mietende", e.target.value)}
                  />
                  {errors.mietende && (
                    <div className="error-text">{errors.mietende}</div>
                  )}
                </div>

                <div className="field-v2">
                  <label>
                    Befristungsgrund <span className="required">*</span>
                  </label>
                  <select
                    className={`select ${errors.befristungsgrund ? "error" : ""}`}
                    value={formData.befristungsgrund}
                    onChange={(e) =>
                      updateFormData("befristungsgrund", e.target.value)
                    }
                  >
                    <option value="">Bitte wählen...</option>
                    <option value="Eigenbedarf">Eigenbedarf nach Rückkehr</option>
                    <option value="Dienstlich">Dienstliche Versetzung</option>
                    <option value="Sanierung">Geplante Sanierung/Umbau</option>
                    <option value="Verkauf">Geplanter Verkauf</option>
                    <option value="Nutzungswechsel">Geplanter Nutzungswechsel</option>
                    <option value="Sonstiges">Sonstiger Grund</option>
                  </select>
                  {errors.befristungsgrund && (
                    <div className="error-text">{errors.befristungsgrund}</div>
                  )}
                </div>

                <div className="field-v2">
                  <label>
                    Begründung der Befristung <span className="required">*</span>
                  </label>
                  <textarea
                    className={`textarea ${errors.befristungsgrund_text ? "error" : ""}`}
                    value={formData.befristungsgrund_text}
                    onChange={(e) =>
                      updateFormData("befristungsgrund_text", e.target.value)
                    }
                    rows="3"
                    placeholder="Bitte geben Sie die gesetzlich erforderliche Begründung an"
                  ></textarea>
                  {errors.befristungsgrund_text && (
                    <div className="error-text">{errors.befristungsgrund_text}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      case 4:
        return (
          <div className="form-section-v2">
            <h2 className="section-title-v2">Miete & Kosten</h2>
            <p className="tagline">Grundmiete, Zuschläge und Betriebskosten.</p>

            <div className="field-v2">
              <label>
                Grundmiete / Monat (EUR) <span className="required">*</span>
              </label>
              <input
                type="number"
                className={`input ${errors.grundmiete ? "error" : ""}`}
                value={formData.grundmiete}
                onChange={(e) => updateFormData("grundmiete", e.target.value)}
                placeholder="z.B. 1450"
              />
              {errors.grundmiete && (
                <div className="error-text">{errors.grundmiete}</div>
              )}
            </div>

            <div className="info-box-v2">
              <strong>Zuschläge (optional)</strong>
              <p className="help-text" style={{ marginTop: "4px" }}>
                Diese Zuschläge werden zur Grundmiete addiert.
              </p>
            </div>

            <div className="field-v2">
              <label>Zuschlag für Möblierung (EUR)</label>
              <input
                type="number"
                className={`input ${errors.zuschlag_moeblierung ? "error" : ""}`}
                value={formData.zuschlag_moeblierung}
                onChange={(e) =>
                  updateFormData("zuschlag_moeblierung", e.target.value)
                }
                placeholder="z.B. 150"
              />
              {errors.zuschlag_moeblierung && (
                <div className="error-text">{errors.zuschlag_moeblierung}</div>
              )}
            </div>

            <div className="field-v2">
              <label>Zuschlag für teilgewerbliche Nutzung (EUR)</label>
              <input
                type="number"
                className={`input ${errors.zuschlag_teilgewerbe ? "error" : ""}`}
                value={formData.zuschlag_teilgewerbe}
                onChange={(e) =>
                  updateFormData("zuschlag_teilgewerbe", e.target.value)
                }
                placeholder="z.B. 100"
              />
              {errors.zuschlag_teilgewerbe && (
                <div className="error-text">{errors.zuschlag_teilgewerbe}</div>
              )}
            </div>

            <div className="field-v2">
              <label>Zuschlag für Untervermietung (EUR)</label>
              <input
                type="number"
                className={`input ${errors.zuschlag_unterverm ? "error" : ""}`}
                value={formData.zuschlag_unterverm}
                onChange={(e) =>
                  updateFormData("zuschlag_unterverm", e.target.value)
                }
                placeholder="z.B. 80"
              />
              {errors.zuschlag_unterverm && (
                <div className="error-text">{errors.zuschlag_unterverm}</div>
              )}
            </div>

            <div className="field-v2">
              <label>Vorauszahlung Heizung/Warmwasser (EUR)</label>
              <input
                type="number"
                className={`input ${errors.vz_heizung ? "error" : ""}`}
                value={formData.vz_heizung}
                onChange={(e) => updateFormData("vz_heizung", e.target.value)}
                placeholder="z.B. 130"
              />
              {errors.vz_heizung && (
                <div className="error-text">{errors.vz_heizung}</div>
              )}
            </div>

            <div className="field-v2">
              <label>Vorauszahlung übrige Betriebskosten (EUR)</label>
              <input
                type="number"
                className={`input ${errors.vz_bk ? "error" : ""}`}
                value={formData.vz_bk}
                onChange={(e) =>
                  updateFormData("vz_bk", e.target.value)
                }
                placeholder="z.B. 220"
              />
              {errors.vz_bk && (
                <div className="error-text">{errors.vz_bk}</div>
              )}
            </div>

            <div className="field-v2">
              <label>Stellplatzmiete (EUR)</label>
              <input
                type="number"
                className={`input ${errors.stellplatzmiete ? "error" : ""}`}
                value={formData.stellplatzmiete}
                onChange={(e) =>
                  updateFormData("stellplatzmiete", e.target.value)
                }
                placeholder="z.B. 90"
              />
              {errors.stellplatzmiete && (
                <div className="error-text">{errors.stellplatzmiete}</div>
              )}
            </div>

            <div className="calculated-v2">
              <div className="summary-row">
                <span className="summary-label">Gesamtmiete / Monat</span>
                <span className="summary-value">{calculateTotalRent()}</span>
              </div>
              <small style={{ color: "#065f46" }}>
                Automatisch berechnet (schreibgeschützt)
              </small>
            </div>

            <div className="field-v2" style={{ marginTop: "16px" }}>
              <label>
                Zahlungsart <span className="required">*</span>
              </label>
              <select
                className={`select ${errors.zahlungsart ? "error" : ""}`}
                value={formData.zahlungsart}
                onChange={(e) => updateFormData("zahlungsart", e.target.value)}
              >
                <option value="">Bitte wählen...</option>
                <option>Überweisung</option>
                <option>SEPA-Lastschrift</option>
              </select>
              {errors.zahlungsart && (
                <div className="error-text">{errors.zahlungsart}</div>
              )}
            </div>

            <div className="field-v2">
              <label>Zahler-IBAN (optional)</label>
              <input
                type="text"
                className={`input ${errors.zahler_iban ? "error" : ""}`}
                value={formData.zahler_iban}
                onChange={(e) => updateFormData("zahler_iban", e.target.value)}
                placeholder="DE89 3704 0044 0532 0130 00"
              />
              {errors.zahler_iban && (
                <div className="error-text">{errors.zahler_iban}</div>
              )}
            </div>

            <div className="field-v2">
              <label>
                Betriebskostenmodell <span className="required">*</span>
              </label>
              <div className="radio-group-v2">
                {[
                  ["vorauszahlung", "Vorauszahlung mit jährlicher Abrechnung"],
                  ["pauschale", "Pauschale"],
                ].map(([value, label]) => (
                  <label key={value} className="radio-option-v2">
                    <input
                      type="radio"
                      value={value}
                      checked={formData.bk_modell === value}
                      onChange={(e) => updateFormData("bk_modell", e.target.value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {errors.bk_modell && (
                <div className="error-text">{errors.bk_modell}</div>
              )}
            </div>

            <div className="field-v2">
              <label>ABRZ (optional)</label>
              <input
                type="text"
                className="input"
                value={formData.abrz}
                onChange={(e) => updateFormData("abrz", e.target.value)}
                placeholder="z.B. relevante Angaben"
              />
            </div>

            <div className="field-v2">
              <label>
                BK-Umlage über WEG <span className="required">*</span>
              </label>
              <div className="radio-group-v2">
                {[
                  ["ja", "Ja"],
                  ["nein", "Nein"],
                ].map(([value, label]) => (
                  <label key={value} className="radio-option-v2">
                    <input
                      type="radio"
                      value={value}
                      checked={formData.bk_weg === value}
                      onChange={(e) => updateFormData("bk_weg", e.target.value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {errors.bk_weg && <div className="error-text">{errors.bk_weg}</div>}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="form-section-v2">
            <h2 className="section-title-v2">Nutzung & Tierhaltung</h2>
            <p className="tagline">Angaben zur Nutzung und Tierhaltung.</p>

            <div className="field-v2">
              <label>
                Nutzung <span className="required">*</span>
              </label>
              <div className="radio-group-v2">
                {[
                  ["wohnen", "Nur zu Wohnzwecken"],
                  ["wohnen_gewerbe", "Wohnen + kleines Gewerbe/Home-Office"],
                ].map(([value, label]) => (
                  <label key={value} className="radio-option-v2">
                    <input
                      type="radio"
                      value={value}
                      checked={formData.nutzung === value}
                      onChange={(e) => updateFormData("nutzung", e.target.value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {errors.nutzung && <div className="error-text">{errors.nutzung}</div>}
            </div>

            <div className="field-v2">
              <label>
                Untervermietung geplant? <span className="required">*</span>
              </label>
              <div className="radio-group-v2">
                {[
                  ["nein", "Nein"],
                  ["teilweise", "Teilweise"],
                  ["vollstaendig", "Vollständig"],
                ].map(([value, label]) => (
                  <label key={value} className="radio-option-v2">
                    <input
                      type="radio"
                      value={value}
                      checked={formData.unterverm === value}
                      onChange={(e) =>
                        updateFormData("unterverm", e.target.value)
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {errors.unterverm && (
                <div className="error-text">{errors.unterverm}</div>
              )}
            </div>

            {/* <div className="field-v2">
              <label>
                Tierhaltung <span className="required">*</span>
              </label>
              <div className="radio-group-v2">
                {[
                  ["kleintiere", "Nur Kleintiere (ohne Erlaubnis)",],
                  ["hund_katze", "Hund/Katze (mit Erlaubnis)"],
                  ["keine", "Keine (außer Kleintiere)"],
                  ["sondervereinbarung", "Sondervereinbarung"],
                ].map(([value, label]) => (
                  <label key={value} className="radio-option-v2">
                    <input
                      type="radio"
                      value={value}
                      checked={formData.tiere === value}
                      onChange={(e) => updateFormData("tiere", e.target.value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {errors.tiere && (
                <div className="error-text">{errors.tiere}</div>
              )}
            </div> */}
            {/* v2 start */}
            <div className="field-v2">
              <label>
                Tierhaltung <span className="required">*</span>
              </label>
              <div className="radio-group-v2">
                {[
                  ["standard", "Nur Kleintiere (ohne Erlaubnis)",],
                  ["restriktiver", "Hund/Katze (mit Erlaubnis)"],
                  ["sondervereinbarung", "Sondervereinbarung"],
                ].map(([value, label]) => (
                  <label key={value} className="radio-option-v2">
                    <input
                      type="radio"
                      value={value}
                      checked={formData.tiere === value}
                      onChange={(e) => updateFormData("tiere", e.target.value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {errors.tiere && (
                <div className="error-text">{errors.tiere}</div>
              )}
            </div>
            {/* v2 end */}
            {/* new added start */}
            {/* <div className="field-v2">
              <label>
                Tierhaltung <span className="required">*</span>
              </label>

              <div className="radio-group-v2">
                {[
                  ["standard", "Standard (Kleintiere erlaubt)"],
                  ["restriktiver", "Restriktiv (Zustimmung für alle Tiere)"],
                  ["individuell", "Individuelle Regelung"],
                ].map(([value, label]) => (
                  <label key={value} className="radio-option-v2">
                    <input
                      type="radio"
                      value={value}
                      checked={formData.tiere_ton === value}
                      onChange={(e) =>
                        updateFormData("tiere_ton", e.target.value)
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              {errors.tiere_ton && (
                <div className="error-text">{errors.tiere_ton}</div>
              )}
            </div>

            <div className="field-v2">
              <label>Sondervereinbarung zur Tierhaltung</label>

              <label className="checkbox-option-v2">
                <input
                  type="checkbox"
                  checked={formData.tiere === "sondervereinbarung"}
                  onChange={(e) =>
                    updateFormData(
                      "tiere",
                      e.target.checked ? "sondervereinbarung" : ""
                    )
                  }
                />
                <span>Zusätzliche Sondervereinbarung aufnehmen</span>
              </label>
            </div> */}
            {/* new added end */}

            {formData.tiere === "sondervereinbarung" && (
              <div className="highlight-box">
                <label>
                  Details zur Sondervereinbarung <span className="required">*</span>
                </label>
                <textarea
                  className={`textarea ${errors.tiere_details ? "error" : ""}`}
                  rows="3"
                  value={formData.tiere_details}
                  onChange={(e) =>
                    updateFormData("tiere_details", e.target.value)
                  }
                  placeholder="Beschreiben Sie die individuelle Vereinbarung zur Tierhaltung..."
                ></textarea>
                {errors.tiere_details && (
                  <div className="error-text">{errors.tiere_details}</div>
                )}
              </div>
            )}

          </div>
        );
      case 6:
        return (
          <div className="form-section-v2">
            <h2 className="section-title-v2">Kaution & Übergabe</h2>
            <p className="tagline">Kautionshöhe und Form.</p>

            <div className="field-v2">
              <label>
                Kautionshöhe (in Monatsmieten) <span className="required">*</span>
              </label>
              <select
                className={`select ${errors.kaution ? "error" : ""}`}
                value={formData.kaution}
                onChange={(e) => updateFormData("kaution", e.target.value)}
              >
                <option value="">Bitte wählen...</option>
                <option value="0">Keine Kaution</option>
                <option value="1">1 Monatsmiete</option>
                <option value="2">2 Monatsmieten</option>
                <option value="3">3 Monatsmieten</option>
              </select>
              {errors.kaution && <div className="error-text">{errors.kaution}</div>}
            </div>

            <div className="field-v2">
              <label>
                Kautionsform <span className="required">*</span>
              </label>
              <select
                className={`select ${errors.kautionsform ? "error" : ""}`}
                value={formData.kautionsform}
                onChange={(e) => updateFormData("kautionsform", e.target.value)}
              >
                <option value="">Bitte wählen...</option>
                <option>Überweisung auf Treuhandkonto</option>
                <option>Barkaution</option>
                <option>Bürgschaft</option>
              </select>
              {errors.kautionsform && (
                <div className="error-text">{errors.kautionsform}</div>
              )}
            </div>

            <div className="field-v2">
              <label>
                Übergabedatum <span className="required">*</span>
              </label>
              <input
                type="date"
                className={`input ${errors.uebergabedatum ? "error" : ""}`}
                value={formData.uebergabedatum}
                onChange={(e) => updateFormData("uebergabedatum", e.target.value)}
              />
              {errors.uebergabedatum && (
                <div className="error-text">{errors.uebergabedatum}</div>
              )}
            </div>
          </div>
        );
      case 7:
        return (
          <div className="form-section-v2">
            <h2 className="section-title-v2">Zusammenfassung</h2>
            <p className="tagline">
              Bitte überprüfen Sie Ihre Angaben, bevor Sie die Daten speichern.
            </p>

            <div className="summary-section-v2">
              <div className="summary-title">Rolle & Kontakt</div>
              <div className="summary-row">
                <span className="summary-label">Rolle</span>
                <span className="summary-value">{formData.rolle || "-"}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Name</span>
                <span className="summary-value">{formData.eigene_name || "-"}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">E-Mail</span>
                <span className="summary-value">{formData.eigene_email || "-"}</span>
              </div>
            </div>

            <div className="summary-section-v2">
              <div className="summary-title">Mietobjekt</div>
              <div className="summary-row">
                <span className="summary-label">Adresse</span>
                <span className="summary-value">{formData.objektadresse || "-"}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Wohnungsart</span>
                <span className="summary-value">{formData.wohnungsart || "-"}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Wohnfläche</span>
                <span className="summary-value">{formData.wohnflaeche || "-"}</span>
              </div>
            </div>

            <div className="summary-section-v2">
              <div className="summary-title">Zustand & Schlüssel</div>
              <div className="summary-row">
                <span className="summary-label">Zustand</span>
                <span className="summary-value">{formData.zustand || "-"}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Übergabeprotokoll</span>
                <span className="summary-value">
                  {formData.uebergabeprotokoll === null
                    ? "-"
                    : formData.uebergabeprotokoll
                      ? "Ja"
                      : "Nein"}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Lärm / Umgebung</span>
                <span className="summary-value">{formData.laerm || "-"}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Schlüsselarten</span>
                <span className="summary-value">
                  {formData.schluessel_arten?.length
                    ? formData.schluessel_arten.join(", ")
                    : "-"}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Gesamtanzahl</span>
                <span className="summary-value">{formData.schluessel_anzahl || "-"}</span>
              </div>
            </div>

            <div className="summary-section-v2">
              <div className="summary-title">Mietzeit</div>
              <div className="summary-row">
                <span className="summary-label">Mietbeginn</span>
                <span className="summary-value">{formData.mietbeginn || "-"}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Vertragsart</span>
                <span className="summary-value">{formData.vertragsart || "-"}</span>
              </div>
              {formData.vertragsart === "Befristet" && (
                <>
                  <div className="summary-row">
                    <span className="summary-label">Mietende</span>
                    <span className="summary-value">{formData.mietende || "-"}</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Befristungsgrund</span>
                    <span className="summary-value">{formData.befristungsgrund || "-"}</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Begründung</span>
                    <span className="summary-value">{formData.befristungsgrund_text || "-"}</span>
                  </div>
                </>
              )}
            </div>

            <div className="summary-section-v2">
              <div className="summary-title">Miete & Kosten</div>
              <div className="summary-row">
                <span className="summary-label">Grundmiete</span>
                <span className="summary-value">{formatCurrency(formData.grundmiete)}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">VZ Heizung/WW</span>
                <span className="summary-value">{formatCurrency(formData.vz_heizung)}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">VZ Betriebskosten</span>
                <span className="summary-value">{formatCurrency(formData.vz_bk)}</span>
              </div>
              <div className="summary-row" style={{ fontWeight: 700, color: "#065f46" }}>
                <span className="summary-label">Gesamtmiete</span>
                <span className="summary-value">{calculateTotalRent()}</span>
              </div>
            </div>

            <div className="info-box-v2" style={{ borderColor: "#10b981" }}>
              <p style={{ fontWeight: 600, color: "#065f46" }}>
                ✓ Ihre Angaben werden beim Abschluss gespeichert und an die Kanzlei übermittelt.
              </p>
            </div>

            <button
              className="btn-success-v2"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={exportJSON}
            >
              📧 Daten absenden und exportieren
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mandanten-page">
      <div className="mandanten-hero">
        <h1>Mandantenmaske</h1>
        <p>Schrittweise Erfassung aller Angaben für den Mietvertrag.</p>
        {renderStepper()}
      </div>

      <div className="form-card-v2">{renderStep()}</div>

      <div className="nav-buttons-container" style={{ marginTop: "20px" }}>
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className="btn-secondary-v2"
        >
          <ChevronLeft /> Zurück
        </button>

        {currentStep < steps.length - 1 ? (
          <button onClick={nextStep} className="btn-primary-v2">
            Weiter <ChevronRight />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**********************
 * ANWALTSMASKE (MASK B)
 **********************/
function AnwaltsMaske() {
  // ====================
  // Constants
  // ====================
  const steps = [
    "Mandantendaten",
    "Vertragsgestaltung",
    "Miete & BK",
    "Nutzung",
    "Instandhaltung",
    "Haftung",
    "Anlagen",
    "Zusammenfassung",
  ];

  const mietanpassungLabels = {
    normalfall: "Normalfall (§ 558 BGB)",
    index: "Indexmiete (§ 557b BGB)",
    staffel: "Staffelmiete",
  };

  const mpb_statusLabels = {
    neubau: "Neubau (nie zuvor vermietet)",
    bereits_vermietet: "Bereits vermietet",
  };

  const mpbVormietLabels = {
    vor_juni_2015: "VOR 01.06.2015",
    nach_juni_2015: "NACH 01.06.2015",
  };

  const mpb_grenzeLabels = {
    ja: "Ja, unter der Grenze",
    nein: "Nein, über der Grenze",
  };

  const heizwwLabels = {
    ja: "Ja - separater § für Heiz-/Warmwasserkosten",
    nein: "Nein - zusammen mit BK",
  };

  // ====================
  // Hooks/state
  // ====================
  const [showImport, setShowImport] = useState(true);
  const [mandantendaten, setMandantendaten] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [importStatus, setImportStatus] = useState("idle");
  const [importMessage, setImportMessage] = useState(
    "Bitte laden Sie die JSON-Datei aus der Mandantenmaske."
  );
  const [downloadUrl, setDownloadUrl] = useState("");
  const [apiError, setApiError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState(createMaskBDefaults);

  const shouldShowMietpreisbremse = () => {
    if (
      formData.mpb_status ||
      formData.mpb_vormiet ||
      formData.mpb_grenze ||
      formData.mpb_vormiete ||
      formData.mpb_modern ||
      formData.mpb_erstmiete
    ) {
      return true;
    }

    const bezugsfertigRaw =
      formData.ro_bezugsfertig || mandantendaten?.bezugsfertig;
    if (!bezugsfertigRaw) return false;

    const normalizeBezugsfertig = (value) => {
      const trimmed = typeof value === "string" ? value.trim() : "";
      if (!trimmed) return null;

      const hasTimeMarker = /[T\s]/.test(trimmed);
      const primary = new Date(
        hasTimeMarker ? trimmed : `${trimmed}T00:00:00`
      );
      if (!Number.isNaN(primary.getTime())) return primary;

      const fallback = new Date(trimmed);
      return Number.isNaN(fallback.getTime()) ? null : fallback;
    };

    const parsedDate = normalizeBezugsfertig(bezugsfertigRaw);
    if (!parsedDate) return false;

    const cutoff = new Date("2014-10-01T00:00:00");
    return parsedDate <= cutoff;
  };

  useEffect(() => {
    if (
      formData.sr_renoviert ||
      formData.sr_unrenoviert_ohne ||
      formData.sr_unrenoviert_mit
    ) {
      return;
    }
    const autoSelection = deriveSrAutoSelection(mandantendaten?.zustand || "");
    if (autoSelection) {
      setSrSelection(autoSelection);
    }
  }, [
    formData.sr_renoviert,
    formData.sr_unrenoviert_ohne,
    formData.sr_unrenoviert_mit,
    mandantendaten?.zustand,
  ]);

  // ====================
  // Derived data
  // ====================
  const combinedMasksDownloadHref = useMemo(() => {
    if (!mandantendaten) return null;
    const combined = { maskA: mandantendaten, maskB: formData };
    const json = JSON.stringify(combined, null, 2);
    return `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  }, [mandantendaten, formData]);

  // ====================
  // Validators
  // ====================
  const buildStepErrors = (step) => {
    const stepErrors = {};

    if (step === 1) {
      if (
        !formData.vertragsart_final ||
        !["unbefristet", "befristet"].includes(formData.vertragsart_final)
      ) {
        stepErrors.vertragsart_final = "Bitte wählen Sie die Vertragsart.";
      }
      if (
        formData.kuendigungsverzicht === "" ||
        formData.kuendigungsverzicht === null ||
        formData.kuendigungsverzicht === undefined
      ) {
        stepErrors.kuendigungsverzicht =
          "Bitte geben Sie den Kündigungsverzicht in Jahren an.";
      }
      if (
        formData.kuendigungsverzicht &&
        !isNonNegativeNumber(formData.kuendigungsverzicht)
      )
        stepErrors.kuendigungsverzicht =
          "Bitte geben Sie eine gültige Zahl (0 oder höher) an.";
    }

    if (step === 2) {
      const showMietpreisbremse = shouldShowMietpreisbremse();
      if (!formData.mietanpassung_normalfall)
        stepErrors.mietanpassung_normalfall = "Bitte wählen Sie die Mietanpassung.";
      if (
        formData.mietanpassung_normalfall === "staffel" &&
        !formData.staffelmiete_schedule
      )
        stepErrors.staffelmiete_schedule =
          "Bitte tragen Sie den Staffelmiete-Zeitplan ein.";
      const anyMPB =
        formData.mpb_vormiete ||
        formData.mpb_modern ||
        formData.mpb_erstmiete;
      if (formData.mpb_grenze === "nein" && !anyMPB) {
        stepErrors.mpb_vormiete =
          "Bitte wählen Sie mindestens einen MPB-Ausnahmetatbestand.";
      }
      if (
        formData.mpb_grenze === "nein" &&
        formData.mpb_vormiete &&
        !formData.mpb_vormiete_text
      ) {
        stepErrors.mpb_vormiete_text =
          "Bitte geben Sie die Vormiete an.";
      }
      if (
        formData.mpb_grenze === "nein" &&
        formData.mpb_vormiete &&
        formData.mpb_vormiete_text &&
        !isPositiveNumber(formData.mpb_vormiete_text)
      ) {
        stepErrors.mpb_vormiete_text =
          "Bitte geben Sie eine gültige Vormiete an.";
      }
      if (
        formData.mpb_grenze === "nein" &&
        formData.mpb_modern &&
        !formData.mpb_modern_text
      ) {
        stepErrors.mpb_modern_text =
          "Bitte beschreiben Sie die Modernisierung.";
      }
      if (
        formData.mpb_grenze === "nein" &&
        formData.mpb_erstmiete &&
        !formData.mpb_erstmiete_text
      ) {
        stepErrors.mpb_erstmiete_text =
          "Bitte geben Sie die Details zur Erstmiete an.";
      }
      if (showMietpreisbremse && !formData.mpb_status) {
        stepErrors.mpb_status =
          "Bitte wählen Sie den Status der Wohnung.";
      }
      if (
        showMietpreisbremse &&
        formData.mpb_status === "bereits_vermietet" &&
        !formData.mpb_vormiet
      ) {
        stepErrors.mpb_vormiet =
          "Bitte wählen Sie, wann das Vormietverhältnis begann.";
      }
      if (showMietpreisbremse && !formData.mpb_grenze) {
        stepErrors.mpb_grenze =
          "Bitte wählen Sie, ob die Miete innerhalb der Mietpreisbremse liegt.";
      }
      if (!formData.faelligkeit) {
        stepErrors.faelligkeit =
          "Bitte wählen Sie die Fälligkeit bzw. das Mahnsystem.";
      }
      if (!formData.heizww_paragraph) {
        stepErrors.heizww_paragraph =
          "Bitte wählen Sie, ob Heiz-/Warmwasserkosten separat geregelt werden.";
      }
    }

    if (step === 3) {
      if (!formData.unterverm_klausel)
        stepErrors.unterverm_klausel =
          "Bitte wählen Sie eine Regelung zur Untervermietung.";
      if (!formData.tiere_ton)
        stepErrors.tiere_ton =
          "Bitte wählen Sie den Klauselton zur Tierhaltung.";
    }

    if (step === 4) {
      if (
        !formData.sr_renoviert &&
        !formData.sr_unrenoviert_ohne &&
        !formData.sr_unrenoviert_mit
      ) {
        stepErrors.sr_renoviert =
          "Bitte wählen Sie ein Schönheitsreparaturen-Modell.";
      }
      if (formData.sr_unrenoviert_mit && !formData.sr_ausgleich_option) {
        stepErrors.sr_ausgleich_option =
          "Bitte wählen Sie eine Ausgleichsoption.";
      }
      if (
        formData.sr_unrenoviert_mit &&
        formData.sr_ausgleich_option === "zuschuss" &&
        !formData.sr_ausgleich_betrag
      ) {
        stepErrors.sr_ausgleich_betrag =
          "Bitte geben Sie den Zuschussbetrag ein.";
      }
      if (
        formData.sr_unrenoviert_mit &&
        formData.sr_ausgleich_option === "zuschuss" &&
        formData.sr_ausgleich_betrag &&
        !isPositiveNumber(formData.sr_ausgleich_betrag)
      ) {
        stepErrors.sr_ausgleich_betrag =
          "Bitte geben Sie einen gültigen Betrag an.";
      }
      if (
        formData.sr_unrenoviert_mit &&
        formData.sr_ausgleich_option === "mietfrei" &&
        !formData.sr_ausgleich_monate
      ) {
        stepErrors.sr_ausgleich_monate =
          "Bitte geben Sie die Anzahl der mietfreien Monate an.";
      }
      if (
        formData.sr_unrenoviert_mit &&
        formData.sr_ausgleich_option === "mietfrei" &&
        formData.sr_ausgleich_monate &&
        !isPositiveNumber(formData.sr_ausgleich_monate)
      ) {
        stepErrors.sr_ausgleich_monate =
          "Bitte geben Sie eine gültige Monatsanzahl an.";
      }
      if (!formData.kleinrep_je)
        stepErrors.kleinrep_je =
          "Bitte wählen Sie die Kleinreparatur-Grenze je Vorgang.";
      if (!formData.kleinrep_jahr)
        stepErrors.kleinrep_jahr =
          "Bitte wählen Sie die Jahresobergrenze für Kleinreparaturen.";
      if (!formData.endrueckgabe_regel)
        stepErrors.endrueckgabe_regel =
          "Bitte wählen Sie die Regelung zur Endrückgabe.";
      if (
        formData.endrueckgabe_regel === "zusätzliche Endarbeiten" &&
        !parseEndarbeitenList(formData.endarbeiten_liste).length
      ) {
        stepErrors.endarbeiten_liste =
          "Bitte geben Sie die Endarbeiten an.";
      }
    }

    if (step === 5) {
      if (!formData.haftung_536a)
        stepErrors.haftung_536a = "Bitte wählen Sie die Haftungsregel.";
      if (!formData.umgebung_laerm)
        stepErrors.umgebung_laerm = "Bitte wählen Sie die Option zu Umgebungslärm.";
      if (!formData.aufrechnung)
        stepErrors.aufrechnung = "Bitte treffen Sie eine Aufrechnungsregel.";
      if (!formData.veraeusserung)
        stepErrors.veraeusserung = "Bitte wählen Sie die Veräußerungsregel.";
    }

    if (step === 6) {
      if (!formData.energie_einbindung)
        stepErrors.energie_einbindung =
          "Bitte wählen Sie die Option zum Energieausweis.";
      if (!formData.dsgvo)
        stepErrors.dsgvo = "Bitte wählen Sie die DSGVO-Angabe.";
      if (!formData.bearbeiter)
        stepErrors.bearbeiter = "Bitte tragen Sie den Bearbeiter ein.";
      if (!formData.anlagen?.length)
        stepErrors.anlagen = "Bitte wählen Sie die Anlagen aus.";
      if (formData.mieter_email && !isValidEmail(formData.mieter_email))
        stepErrors.mieter_email = "Bitte geben Sie eine gültige E-Mail an.";
      if (formData.mieter_telefon && !isValidPhone(formData.mieter_telefon))
        stepErrors.mieter_telefon = "Bitte geben Sie eine gültige Telefonnummer an.";
    }

    return stepErrors;
  };

  const validateStep = (step) => {
    const stepErrors = buildStepErrors(step);
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const validateAll = () => {
    const combined = {};
    steps.forEach((_, idx) => {
      Object.assign(combined, buildStepErrors(idx));
    });
    setErrors(combined);
    return Object.keys(combined).length === 0;
  };

  // ====================
  // Data-normalization helpers
  // ====================
  function formatCurrency(value) {
    const num = parseFloat(value || "0");
    if (Number.isNaN(num)) return "-";
    return `${num.toFixed(2)} EUR`;
  }

  function formatEuroValue(value) {
    const num = parseFloat(value ?? "");
    if (!Number.isFinite(num)) return "";
    return new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  function formatDecimalValue(value) {
    const num = parseFloat(value ?? "");
    if (!Number.isFinite(num)) return "";
    return new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  function deriveCityFromAddress(address = "") {
    if (!address) return "";
    const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
  }

  function deriveParties(maskAData = {}) {
    const baseParty = (name, address, iban, vat, tax, representative) => ({
      name: name || "",
      address: address || "",
      iban: iban || "",
      vat: vat || "",
      tax: tax || "",
      representative: representative || "",
    });

    const ownRepresentative =
      maskAData.wird_vertreten === "Ja" ? maskAData.vertreten_durch : "";
    const counterRepresentative =
      maskAData.gegenpartei_vertreten_durch || "";

    const own = baseParty(
      maskAData.eigene_name,
      maskAData.eigene_anschrift,
      maskAData.eigene_iban,
      maskAData.ust_id,
      maskAData.steuernummer,
      ownRepresentative
    );

    const counterparty = baseParty(
      maskAData.gegenpartei_name,
      maskAData.gegenpartei_anschrift,
      maskAData.zahler_iban,
      "",
      "",
      counterRepresentative
    );

    if (maskAData.rolle === "Vermieter") {
      return { landlord: own, tenant: counterparty };
    }

    if (maskAData.rolle === "Mieter") {
      return { landlord: counterparty.name ? counterparty : own, tenant: own };
    }

    return { landlord: own, tenant: counterparty };
  }

  function combineHousingDescription(maskAData = {}) {
    const parts = [];
    if (maskAData.wohnung_bez) parts.push(maskAData.wohnung_bez);
    else if (maskAData.wohnungsart) parts.push(maskAData.wohnungsart);

    const extras = [
      ...(maskAData.nebenraeume || []),
      ...(maskAData.aussenbereich || []),
    ]
      .filter(Boolean)
      .join(", ");

    if (extras) parts.push(extras);
    return parts.join("; ");
  }

  function buildZusatzBkText(maskBData = {}) {
    const items = (maskBData.zusatz_bk || []).filter(Boolean);
    if (!items.length)
      return "Es werden keine zusätzlichen Positionen vereinbart.";
    return items.map((item, idx) => `${idx + 1}. ${item}`).join("\n");
  }

  function deriveZustandText(maskAData = {}) {
    const mapping = {
      renoviert: "renoviert",
      "neu erstellt": "ist neu erstellt",
      "gebraucht/vertragsgemäß": "in gebrauchtem, vertragsgemäßem Zustand",
    };
    return mapping[maskAData.zustand] || maskAData.zustand || "";
  }

  function buildAnnexInfo(annexes = []) {
    const list = (annexes || []).filter(Boolean);
    const formattedList = list
      .map((item, idx) => `Anlage MV.${idx + 1}: ${item}`)
      .join("\n");

    const findIndex = (needle) =>
      list.findIndex((item) => item.toLowerCase().includes(needle));
    const xIndex = findIndex("dsgvo");
    const yIndex = findIndex("energieausweis");

    return {
      formattedList,
      x: xIndex >= 0 ? xIndex + 1 : "",
      y: yIndex >= 0 ? yIndex + 1 : "",
    };
  }

  function buildPlaceholderMapping(maskAData = {}, maskBData = {}) {
    const maskA = normalizeMaskAKeys(maskAData);
    const maskB = normalizeMaskBKeys(maskBData);
    const parties = deriveParties(maskA);
    const annexInfo = buildAnnexInfo(maskB.anlagen || []);

    const keyCount = maskA.schluessel_anzahl || "";
    const depositMonths = maskA.kaution || "";
    const grundmiete = parseFloat(maskA.grundmiete || "0") || 0;
    const depositAmount = grundmiete * (parseFloat(depositMonths || "0") || 0);
    const formattedDeposit = depositAmount
      ? `${formatEuroValue(depositAmount)} EUR`
      : "";

    const ausstattung = () => {
      if (Array.isArray(maskA.ausstattung)) {
        return maskA.ausstattung.filter(Boolean).join(", ") || "keine";
      }
      return maskA.ausstattung || "keine";
    };

    return {
      AMOUNT: maskB.mpb_vormiete_text || maskB.mpb_vormiete_betrag || "",
      ANZAHL: keyCount || depositMonths || "",
      ARTEN: (maskA.schluessel_arten || []).filter(Boolean).join(", "),
      AUSSTATTUNG: ausstattung(),
      BETRAG: formattedDeposit,
      BETRAG_JE: maskB.kleinrep_je || "",
      COMPLETE_ANNEX_LIST: annexInfo.formattedList,
      CUSTOM_PET_TEXT: maskA.tiere_details || "",
      CUSTOM_SUBLETTING_TEXT: maskB.unterverm_klausel || "",
      DATE: maskA.bezugsfertig || "",
      DATUM: maskB.bearbeitungsdatum || new Date().toLocaleDateString("de-DE"),
      DETAILS: maskA.tiere_details || "",
      ENDARBEITEN_LISTE: formatEndarbeitenList(maskB.endarbeiten_liste),
      FLAECHE: formatDecimalValue(maskA.wohnflaeche),
      IBAN:
        parties.landlord.iban ||
        maskA.eigene_iban ||
        maskA.zahler_iban ||
        "",
      JAHRE: maskB.kuendigungsverzicht || "",
      LANDLORD_ADDRESS: parties.landlord.address,
      LANDLORD_NAME: parties.landlord.name,
      LANDLORD_REPRESENTATIVE: parties.landlord.representative,
      MEA: maskA.mea || "",
      MIETBEGINN: maskA.mietbeginn || "",
      MONATE: "",
      OBERGRENZE: maskB.kleinrep_jahr || "",
      OBJEKTADRESSE: maskA.objektadresse || "",
      ORT: deriveCityFromAddress(
        maskA.objektadresse ||
        maskB.ro_objektadresse ||
        parties.landlord.address ||
        parties.tenant.address
      ),
      REPRESENTATIVE_NAME:
        parties.landlord.representative || parties.tenant.representative || "",
      STAFFELMIETE_SCHEDULE: maskB.staffelmiete_schedule || "",
      TAX_NUMBER: parties.landlord.tax,
      TENANT_ADDRESS: parties.tenant.address,
      TENANT_NAME: parties.tenant.name,
      TENANT_REPRESENTATIVE: parties.tenant.representative,
      VAT_ID: parties.landlord.vat,
      WEG_TEXT: maskB.weg_text || "",
      WOHNUNG_BESCHREIBUNG: combineHousingDescription(maskA),
      X: annexInfo.x,
      Y: annexInfo.y,
      ZUSATZ_BK: buildZusatzBkText(maskB),
      ZUSTAND: deriveZustandText(maskA),
    };
  }

  function calculateImportedTotalRent(maskAData = mandantendaten) {
    if (!maskAData) return "-";
    const toNumber = (val) => parseFloat(val || "0") || 0;
    const total =
      toNumber(maskAData.grundmiete) +
      toNumber(maskAData.zuschlag_moeblierung) +
      toNumber(maskAData.zuschlag_teilgewerbe) +
      toNumber(maskAData.zuschlag_unterverm) +
      toNumber(maskAData.vz_heizung) +
      toNumber(maskAData.vz_bk) +
      toNumber(maskAData.stellplatzmiete);

    return formatCurrency(total);
  }

  function enforceExclusivity(data) {
    const next = { ...data };
    if (next.mietanpassung_normalfall === "index") {
      next.indexmiete = "Ja";
      next.staffelmiete = "Nein";
      next.staffelmiete_schedule = "";
    } else if (next.mietanpassung_normalfall === "staffel") {
      next.indexmiete = "Nein";
      next.staffelmiete = "Ja";
    } else if (next.mietanpassung_normalfall === "normalfall") {
      next.indexmiete = "Nein";
      next.staffelmiete = "Nein";
      next.staffelmiete_schedule = "";
    } else if (!next.mietanpassung_normalfall) {
      if (next.indexmiete === "Ja") next.mietanpassung_normalfall = "index";
      else if (next.staffelmiete === "Ja") next.mietanpassung_normalfall = "staffel";
      else if (
        next.indexmiete === "Nein" &&
        next.staffelmiete === "Nein"
      )
        next.mietanpassung_normalfall = "normalfall";
    }
    return next;
  }

  function deriveContact(maskAData = {}, fallback = {}) {
    const role = maskAData.rolle;
    if (role === "Vermieter") {
      return {
        email: maskAData.gegenpartei_email || fallback.mieter_email || "",
        phone: maskAData.gegenpartei_telefon || fallback.mieter_telefon || "",
      };
    }

    if (role === "Mieter") {
      return {
        email: maskAData.eigene_email || fallback.mieter_email || "",
        phone: maskAData.eigene_telefon || fallback.mieter_telefon || "",
      };
    }

    return {
      email:
        maskAData.gegenpartei_email ||
        maskAData.eigene_email ||
        fallback.mieter_email ||
        "",
      phone:
        maskAData.gegenpartei_telefon ||
        maskAData.eigene_telefon ||
        fallback.mieter_telefon ||
        "",
    };
  }

  function deriveReadOnlyFields(maskAData = {}, fallback = {}) {
    const totalRent = calculateImportedTotalRent(maskAData);
    return {
      ro_rolle: maskAData.rolle || fallback.ro_rolle || "",
      ro_name: maskAData.eigene_name || fallback.ro_name || "",
      ro_email: maskAData.eigene_email || fallback.ro_email || "",
      ro_telefon: maskAData.eigene_telefon || fallback.ro_telefon || "",
      ro_objektadresse:
        maskAData.objektadresse || fallback.ro_objektadresse || "",
      ro_wohneinheit:
        maskAData.wohnungsart ||
        maskAData.wohnung_bez ||
        fallback.ro_wohneinheit ||
        "",
      ro_bezugsfertig: maskAData.bezugsfertig || fallback.ro_bezugsfertig || "",
      ro_mietbeginn: maskAData.mietbeginn || fallback.ro_mietbeginn || "",
      ro_grundmiete: maskAData.grundmiete || fallback.ro_grundmiete || "",
      ro_gesamtmiete:
        totalRent !== "-" ? totalRent : fallback.ro_gesamtmiete || "",
      ro_vz_heizung: maskAData.vz_heizung || fallback.ro_vz_heizung || "",
    };
  }

  function deriveSrAutoSelection(zustand = "") {
    const normalized = zustand.toLowerCase();
    if (normalized.includes("unrenoviert")) return "sr_unrenoviert_ohne";
    if (normalized.includes("teilsaniert")) return "sr_unrenoviert_mit";
    if (normalized.includes("renoviert")) return "sr_renoviert";
    return null;
  }

  // ====================
  // API handlers
  // ====================
  function applyPrefill(maskAData, importedMaskB = {}) {
    setFormData((prev) => {
      const normalizedMaskB = normalizeMaskBKeys(importedMaskB);
      const contact = deriveContact(maskAData, prev);
      const readonlyFields = deriveReadOnlyFields(maskAData, prev);
      const merged = {
        ...prev,
        ...normalizedMaskB,
        ...readonlyFields,
        vertragsart_final:
          normalizedMaskB.vertragsart_final ||
          maskAData.vertragsart ||
          prev.vertragsart_final,
        kuendigungsverzicht:
          normalizedMaskB.kuendigungsverzicht ?? prev.kuendigungsverzicht,
        mieter_email: contact.email,
        mieter_telefon: contact.phone,
      };
      return enforceExclusivity(merged);
    });
  }

  function handleFileImport(event) {
    const file = event.target.files[0];
    if (file) {
      setImportStatus("reading");
      setImportMessage("Datei wird gelesen…");
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          const importedMaskA = normalizeMaskAKeys(data.maskA || data);
          const importedMaskB = data.maskB || {};

          setMandantendaten(importedMaskA);
          setShowImport(false);
          applyPrefill(importedMaskA, importedMaskB);
          setImportStatus("done");
          setImportMessage("Mandantendaten erfolgreich geladen.");
        } catch (error) {
          alert(
            "Fehler beim Laden der JSON-Datei. Bitte überprüfen Sie das Format."
          );
          setImportStatus("error");
          setImportMessage("Import fehlgeschlagen – bitte erneut versuchen.");
        }
      };
      reader.readAsText(file);
    }
  }

  function updateFormData(field, value) {
    setFormData((prev) => enforceExclusivity({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const clone = { ...prev };
        delete clone[field];
        return clone;
      });
    }
  }

  function toggleArrayValue(field, value) {
    setFormData((prev) => {
      const current = prev[field] || [];
      const exists = current.includes(value);
      const nextValues = exists
        ? current.filter((item) => item !== value)
        : [...current, value];
      return enforceExclusivity({ ...prev, [field]: nextValues });
    });
    if (errors[field]) {
      setErrors((prev) => {
        const clone = { ...prev };
        delete clone[field];
        return clone;
      });
    }
  }

  function setSrSelection(selected) {
    setFormData((prev) =>
      enforceExclusivity({
        ...prev,
        sr_renoviert: false,
        sr_unrenoviert_ohne: false,
        sr_unrenoviert_mit: false,
        sr_ausgleich_option:
          selected === "sr_unrenoviert_mit" ? prev.sr_ausgleich_option : "",
        sr_ausgleich_betrag:
          selected === "sr_unrenoviert_mit" ? prev.sr_ausgleich_betrag : "",
        sr_ausgleich_monate:
          selected === "sr_unrenoviert_mit" ? prev.sr_ausgleich_monate : "",
        [selected]: true,
      })
    );
    if (
      errors.sr_renoviert ||
      errors.sr_ausgleich_option ||
      errors.sr_ausgleich_betrag ||
      errors.sr_ausgleich_monate
    ) {
      setErrors((prev) => {
        const clone = { ...prev };
        delete clone.sr_renoviert;
        delete clone.sr_ausgleich_option;
        delete clone.sr_ausgleich_betrag;
        delete clone.sr_ausgleich_monate;
        return clone;
      });
    }
  }

  function setSrAusgleichOption(value) {
    setFormData((prev) =>
      enforceExclusivity({
        ...prev,
        sr_ausgleich_option: value,
        sr_ausgleich_betrag: value === "zuschuss" ? prev.sr_ausgleich_betrag : "",
        sr_ausgleich_monate: value === "mietfrei" ? prev.sr_ausgleich_monate : "",
      })
    );
    if (
      errors.sr_ausgleich_option ||
      errors.sr_ausgleich_betrag ||
      errors.sr_ausgleich_monate
    ) {
      setErrors((prev) => {
        const clone = { ...prev };
        delete clone.sr_ausgleich_option;
        delete clone.sr_ausgleich_betrag;
        delete clone.sr_ausgleich_monate;
        return clone;
      });
    }
  }

  function nextStep() {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) =>
        Math.min(prev + 1, steps.length - 1)
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function prevStep() {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleExportFinalJSON() {
    return exportFinalJSONHelper({
      mandantendaten,
      formData,
      validateAll,
      setApiError,
      setDownloadUrl,
      setIsGenerating,
      apiBase: API_BASE,
      templatePath: TEMPLATE_OPTION.value,
      createMaskADefaults,
      createMaskBDefaults,
      normalizeMaskAKeys,
      normalizeMaskBKeys,
      parseEndarbeitenList,
      parseStaffelSchedule,
      buildPlaceholderMapping,
    });
  }

  // ====================
  // Render
  // ====================
  const renderSummaryField = (label, value, formatter) => {
    const displayValue =
      value || value === 0
        ? formatter
          ? formatter(value)
          : value
        : "-";

    return (
      <div className="summary-field">
        <span className="summary-label">{label}</span>
        <span className="summary-value">{displayValue}</span>
      </div>
    );
  };

  const srCaseClass = (isSelected) =>
    `sr-case ${isSelected ? "sr-case--green" : "sr-case--amber"}`;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        if (showImport) {
          return (
            <div>
              <h2 className="section-title">Datensatz übernehmen</h2>
              <div className="import-section">
                <div className="upload-zone">
                  <div className="upload-icon">
                    <UploadIcon />
                  </div>
                  <h3
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: "600",
                      marginBottom: "0.5rem",
                      color: "#6b21a8",
                    }}
                  >
                    JSON-Datei der Mandantenmaske hochladen
                  </h3>
                  <p className="help-text" style={{ marginBottom: "1rem" }}>
                    Laden Sie die JSON-Datei hoch, die aus der Mandantenmaske
                    exportiert wurde. Die Kontakt- und Vertragsdaten werden
                    automatisch übernommen.
                  </p>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    style={{ display: "none" }}
                    id="json-upload"
                  />
                  <label
                    htmlFor="json-upload"
                    className="button button-primary"
                    style={{ background: "#7c3aed" }}
                  >
                    Datei auswählen
                  </label>

                  <div style={{ marginTop: "1rem" }}>
                    <span
                      className={`status-pill ${importStatus === "done"
                        ? "success"
                        : importStatus === "error"
                          ? "error"
                          : "info"
                        }`}
                    >
                      {importMessage}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h2
                className="section-title"
                style={{ marginBottom: 0 }}
              >
                Mandantendaten (Read-Only)
              </h2>
              <span
                className={`status-pill ${importStatus === "done" ? "success" : "info"
                  }`}
              >
                {importMessage}
              </span>
              <button
                onClick={() => setShowImport(true)}
                style={{
                  fontSize: "0.875rem",
                  color: "#7c3aed",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Andere Datei laden
              </button>
            </div>

            <div className="alert alert-info">
              Diese Daten stammen aus der Mandantenmaske und
              können hier nicht bearbeitet werden.
            </div>

            <div className="summary-section">
              <div className="summary-title">Rolle & Kontakt</div>
              {renderSummaryField("Rolle", formData.ro_rolle)}
              {renderSummaryField("Name / Firma", formData.ro_name)}
              {renderSummaryField("E-Mail", formData.ro_email)}
              {renderSummaryField("Telefon", formData.ro_telefon)}
            </div>

            <div className="summary-section">
              <div className="summary-title">Objektangaben</div>
              {renderSummaryField("Objektadresse", formData.ro_objektadresse)}
              {renderSummaryField(
                "Wohneinheit",
                formData.ro_wohneinheit
              )}
              {renderSummaryField(
                "Heizkosten (EUR)",
                formData.ro_vz_heizung,
                formatCurrency
              )}
            </div>

            <div className="summary-section">
              <div className="summary-title">Mietzeit</div>
              {renderSummaryField("Mietbeginn", formData.ro_mietbeginn)}
              {renderSummaryField(
                "Bezugsfertig seit",
                formData.ro_bezugsfertig
              )}
            </div>

            <div className="summary-section">
              <div className="summary-title">Miete</div>
              {renderSummaryField(
                "Grundmiete (EUR)",
                formData.ro_grundmiete,
                formatCurrency
              )}
              {renderSummaryField(
                "Gesamtmiete (EUR)",
                formData.ro_gesamtmiete || calculateImportedTotalRent()
              )}
            </div>
          </div>
        );

      case 1:
        return (
          <div>
            <h2 className="section-title">
              Vertragsgestaltung
            </h2>

            <div className="form-group">
              <label className="label">
                Vertragsart final{" "}
                <span className="required">*</span>
              </label>
              <div
                className="radio-group"
                role="radiogroup"
                aria-required="true"
                aria-invalid={Boolean(errors.vertragsart_final)}
              >
                <label className="radio-label">
                  <input
                    type="radio"
                    name="vertragsart_final"
                    value="unbefristet"
                    required
                    aria-required="true"
                    aria-invalid={Boolean(errors.vertragsart_final)}
                    checked={
                      formData.vertragsart_final === "unbefristet"
                    }
                    onChange={(e) =>
                      updateFormData(
                        "vertragsart_final",
                        e.target.value
                      )
                    }
                  />
                  Unbefristet
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="vertragsart_final"
                    value="befristet"
                    required
                    aria-required="true"
                    aria-invalid={Boolean(errors.vertragsart_final)}
                    checked={
                      formData.vertragsart_final === "befristet"
                    }
                    onChange={(e) =>
                      updateFormData(
                        "vertragsart_final",
                        e.target.value
                      )
                    }
                  />
                  Befristet (mit § 575-Grund aus Mandantendaten)
                </label>
              </div>
              {errors.vertragsart_final && (
                <div className="error-text">{errors.vertragsart_final}</div>
              )}
            </div>

            <div className="form-group">
              <label className="label">
                Kündigungsverzicht (Jahre){" "}
                <span className="required">*</span>
              </label>
              <input
                type="number"
                className={`input ${errors.kuendigungsverzicht ? "error" : ""}`}
                min="0"
                required
                value={formData.kuendigungsverzicht}
                onChange={(e) =>
                  updateFormData(
                    "kuendigungsverzicht",
                    e.target.value
                  )
                }
              />
              <div className="help-text">
                0 = kein Verzicht
              </div>
              {errors.kuendigungsverzicht && (
                <div className="error-text">{errors.kuendigungsverzicht}</div>
              )}
            </div>
          </div>
        );

      case 2: {
        const showMietpreisbremse = shouldShowMietpreisbremse();

        const showMpbStufe2 = formData.mpb_status === "bereits_vermietet";
        const showMpbStufe4 = formData.mpb_grenze === "nein";

        return (
          <div className="form-section-v2">
            <h2 className="section-title">Miethöhe & Betriebskosten</h2>

            <div className="field-v2">
              <label>
                Mietanpassung <span className="required">*</span>
              </label>
              <div className="radio-group-v2">
                <label className="radio-option-v2">
                  <input
                    type="radio"
                    name="mietanpassung_normalfall"
                    value="normalfall"
                    checked={formData.mietanpassung_normalfall === "normalfall"}
                    onChange={(e) =>
                      updateFormData("mietanpassung_normalfall", e.target.value)
                    }
                  />
                  <span>Normalfall (Gesetzliche Regelungen § 558 BGB)</span>
                </label>
                <label className="radio-option-v2">
                  <input
                    type="radio"
                    name="mietanpassung_normalfall"
                    value="index"
                    checked={formData.mietanpassung_normalfall === "index"}
                    onChange={(e) =>
                      updateFormData("mietanpassung_normalfall", e.target.value)
                    }
                  />
                  <span>Indexmiete (§ 557b BGB)</span>
                </label>
                <label className="radio-option-v2">
                  <input
                    type="radio"
                    name="mietanpassung_normalfall"
                    value="staffel"
                    checked={formData.mietanpassung_normalfall === "staffel"}
                    onChange={(e) =>
                      updateFormData("mietanpassung_normalfall", e.target.value)
                    }
                  />
                  <span>Staffelmiete</span>
                </label>
              </div>
              <p className="help-text">
                Indexmiete und Staffelmiete schließen sich gegenseitig aus
              </p>
              {errors.mietanpassung_normalfall && (
                <div className="error-text">{errors.mietanpassung_normalfall}</div>
              )}
            </div>

            {formData.mietanpassung_normalfall === "staffel" && (
              <div className="field-v2">
                <label>
                  Staffelmiete - Zeitplan <span className="required">*</span>
                </label>
                <textarea
                  className={`textarea ${errors.staffelmiete_schedule ? "error" : ""}`}
                  rows="3"
                  placeholder="z.B. ab 01.01.2025 +50 EUR; ab 01.01.2026 +50 EUR"
                  value={formData.staffelmiete_schedule}
                  onChange={(e) =>
                    updateFormData("staffelmiete_schedule", e.target.value)
                  }
                ></textarea>
                {errors.staffelmiete_schedule && (
                  <div className="error-text">{errors.staffelmiete_schedule}</div>
                )}
              </div>
            )}

            {showMietpreisbremse && (
              <div
                style={{
                  background: "#fef2f2",
                  padding: "20px",
                  borderRadius: "8px",
                  borderLeft: "4px solid #dc2626",
                  margin: "20px 0",
                }}
              >
                <h3 style={{ color: "#991b1b", marginBottom: "15px" }}>
                  ⚠️ Mietpreisbremsen-Prüfung
                </h3>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#7f1d1d",
                    marginBottom: "20px",
                  }}
                >
                  Das Objekt wurde vor dem 01.10.2014 bezugsfertig. Bitte
                  prüfen Sie die Mietpreisbremse.
                </p>

                <div className="field-v2">
                  <label>
                    Stufe 1: Status der Wohnung <span className="required">*</span>
                  </label>
                  <div className="radio-group-v2">
                    <label className="radio-option-v2">
                      <input
                        type="radio"
                        name="mpb_status"
                        value="neubau"
                        checked={formData.mpb_status === "neubau"}
                        onChange={(e) =>
                          updateFormData("mpb_status", e.target.value)
                        }
                      />
                      <span>Neubau (nie zuvor vermietet)</span>
                    </label>
                    <label className="radio-option-v2">
                      <input
                        type="radio"
                        name="mpb_status"
                        value="bereits_vermietet"
                        checked={
                          formData.mpb_status === "bereits_vermietet"
                        }
                        onChange={(e) =>
                          updateFormData("mpb_status", e.target.value)
                        }
                      />
                      <span>Bereits vermietet</span>
                    </label>
                  </div>
                  {errors.mpb_status && (
                    <div className="error-text">{errors.mpb_status}</div>
                  )}
                </div>

                {showMpbStufe2 && (
                  <div
                    style={{
                      marginTop: "20px",
                      padding: "15px",
                      background: "white",
                      borderRadius: "8px",
                    }}
                  >
                    <div className="field-v2">
                      <label>
                        Stufe 2: Vormietverhältnis begann... <span className="required">*</span>
                      </label>
                      <div className="radio-group-v2">
                        <label className="radio-option-v2">
                          <input
                            type="radio"
                            name="mpb_vormiet"
                            value="vor_juni_2015"
                            checked={
                              formData.mpb_vormiet ===
                              "vor_juni_2015"
                            }
                            onChange={(e) =>
                              updateFormData(
                                "mpb_vormiet",
                                e.target.value
                              )
                            }
                          />
                          <span>VOR 01.06.2015</span>
                        </label>
                        <label className="radio-option-v2">
                          <input
                            type="radio"
                            name="mpb_vormiet"
                            value="nach_juni_2015"
                            checked={
                              formData.mpb_vormiet ===
                              "nach_juni_2015"
                            }
                            onChange={(e) =>
                              updateFormData(
                                "mpb_vormiet",
                                e.target.value
                              )
                            }
                          />
                          <span>NACH 01.06.2015</span>
                        </label>
                      </div>
                      {errors.mpb_vormiet && (
                        <div className="error-text">{errors.mpb_vormiet}</div>
                      )}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    marginTop: "20px",
                    padding: "15px",
                    background: "white",
                    borderRadius: "8px",
                  }}
                >
                  <div className="field-v2">
                    <label>
                      Stufe 3: Liegt die Miete innerhalb der Mietpreisbremse?{' '}
                      <span className="required">*</span>
                    </label>
                    <div className="radio-group-v2">
                      <label className="radio-option-v2">
                        <input
                          type="radio"
                          name="mpb_grenze"
                          value="ja"
                          checked={formData.mpb_grenze === "ja"}
                          onChange={(e) =>
                            updateFormData("mpb_grenze", e.target.value)
                          }
                        />
                        <span>
                          Ja, unter der Grenze (max. 110% ortsübliche Vergleichsmiete)
                        </span>
                      </label>
                      <label className="radio-option-v2">
                        <input
                          type="radio"
                          name="mpb_grenze"
                          value="nein"
                          checked={formData.mpb_grenze === "nein"}
                          onChange={(e) =>
                            updateFormData("mpb_grenze", e.target.value)
                          }
                        />
                        <span>Nein, über der Grenze</span>
                      </label>
                    </div>
                    {errors.mpb_grenze && (
                      <div className="error-text">{errors.mpb_grenze}</div>
                    )}
                  </div>
                </div>

                {showMpbStufe4 && (
                  <div
                    style={{
                      marginTop: "20px",
                      padding: "15px",
                      background: "#fef3c7",
                      borderRadius: "8px",
                    }}
                  >
                    <h4 style={{ color: "#92400e", marginBottom: "10px" }}>
                      Stufe 4: Begründung für Überschreitung
                    </h4>

                    <div className="field-v2">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="mpb_vormiete"
                          checked={!!formData.mpb_vormiete}
                          onChange={(e) =>
                            updateFormData("mpb_vormiete", e.target.checked)
                          }
                        />
                        <span>Vormiete war höher</span>
                      </label>
                      {errors.mpb_vormiete && (
                        <div className="error-text">{errors.mpb_vormiete}</div>
                      )}
                    </div>

                    <div className="field-v2" style={{ marginLeft: "25px" }}>
                      <label>Vormiete (EUR/Monat)</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="z.B. 1650"
                        value={formData.mpb_vormiete_text}
                        onChange={(e) =>
                          updateFormData("mpb_vormiete_text", e.target.value)
                        }
                      />
                      {errors.mpb_vormiete_text && (
                        <div className="error-text">{errors.mpb_vormiete_text}</div>
                      )}
                    </div>

                    <div className="field-v2">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="mpb_modern"
                          checked={!!formData.mpb_modern}
                          onChange={(e) =>
                            updateFormData(
                              "mpb_modern",
                              e.target.checked
                            )
                          }
                        />
                        <span>Modernisierung durchgeführt</span>
                      </label>
                    </div>

                    <div className="field-v2" style={{ marginLeft: "25px" }}>
                      <label>Details zur Modernisierung</label>
                      <textarea
                        rows="3"
                        className="textarea"
                        placeholder="Beschreibung der Modernisierungsmaßnahmen und Kosten..."
                        value={formData.mpb_modern_text}
                        onChange={(e) =>
                          updateFormData(
                            "mpb_modern_text",
                            e.target.value
                          )
                        }
                      />
                      {errors.mpb_modern_text && (
                        <div className="error-text">{errors.mpb_modern_text}</div>
                      )}
                    </div>

                    <div className="field-v2">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="mpb_erstmiete"
                          checked={!!formData.mpb_erstmiete}
                          onChange={(e) =>
                            updateFormData(
                              "mpb_erstmiete",
                              e.target.checked
                            )
                          }
                        />
                        <span>Erstmiete nach umfassender Modernisierung</span>
                      </label>
                    </div>

                    <div className="field-v2" style={{ marginLeft: "25px" }}>
                      <label>Details zur Erstmiete</label>
                      <textarea
                        rows="3"
                        className="textarea"
                        placeholder="Datum und Umfang der Modernisierung..."
                        value={formData.mpb_erstmiete_text}
                        onChange={(e) =>
                          updateFormData("mpb_erstmiete_text", e.target.value)
                        }
                      />
                      {errors.mpb_erstmiete_text && (
                        <div className="error-text">{errors.mpb_erstmiete_text}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="field-v2">
              <label>
                Fälligkeit / Mahnsystem <span className="required">*</span>
              </label>
              <select
                className="select"
                value={formData.faelligkeit}
                onChange={(e) => updateFormData("faelligkeit", e.target.value)}
              >
                <option value="">Bitte wählen...</option>
                <option value="spätestens 3. Werktag des Monats">
                  Spätestens 3. Werktag des Monats
                </option>
                <option value="abweichende Regelung">Abweichende Regelung</option>
              </select>
              {errors.faelligkeit && (
                <div className="error-text">{errors.faelligkeit}</div>
              )}
            </div>

            <div className="field-v2">
              <label>Zusatz-BK-Positionen</label>
              <div className="checkbox-group-v2">
                {["Objektschutz", "Dachrinnenreinigung", "Beleuchtung allgemeiner Flächen", "Wartung technischer Anlagen", "Gartenpflege", "Hausmeister"].map(
                  (option) => (
                    <label key={option} className="checkbox-option-v2">
                      <input
                        type="checkbox"
                        checked={formData.zusatz_bk.includes(option)}
                        onChange={() =>
                          toggleArrayValue("zusatz_bk", option)
                        }
                      />
                      <span>{option}</span>
                    </label>
                  )
                )}
              </div>
            </div>

            <div className="field-v2">
              <label>WEG-Verweis / Schlüssel (nur bei ETW)</label>
              <textarea
                className="textarea"
                placeholder="z.B. Teilungserklärung § ...; MEA lt. Mandantendaten"
                rows="2"
                value={formData.weg_text}
                onChange={(e) =>
                  updateFormData("weg_text", e.target.value)
                }
              />
            </div>

            <div className="field-v2">
              <label>
                Heiz-/WW als eigener Paragraph? <span className="required">*</span>
              </label>
              <div className="radio-group-v2">
                <label className="radio-option-v2">
                  <input
                    type="radio"
                    name="heizww"
                    value="ja"
                    checked={formData.heizww_paragraph === "ja"}
                    onChange={(e) =>
                      updateFormData("heizww_paragraph", e.target.value)
                    }
                  />
                  <span>Ja - separater § für Heiz-/Warmwasserkosten</span>
                </label>
                <label className="radio-option-v2">
                  <input
                    type="radio"
                    name="heizww"
                    value="nein"
                    checked={formData.heizww_paragraph === "nein"}
                    onChange={(e) =>
                      updateFormData("heizww_paragraph", e.target.value)
                    }
                  />
                  <span>Nein - zusammen mit BK</span>
                </label>
              </div>
              {errors.heizww_paragraph && (
                <div className="error-text">{errors.heizww_paragraph}</div>
              )}
            </div>
          </div>
        );
      }

      case 3:
        return (
          <div>
            <h2 className="section-title">
              Nutzung & Nebenpflichten
            </h2>

            <div className="form-group">
              <label className="label">
                Untervermietung - Klauselart{" "}
                <span className="required">*</span>
              </label>
              <select
                className={`select ${errors.unterverm_klausel ? "error" : ""}`}
                value={formData.unterverm_klausel}
                onChange={(e) =>
                  updateFormData(
                    "unterverm_klausel",
                    e.target.value
                  )
                }
              >
                <option value="">Bitte wählen...</option>
                <option value="Zustimmung + Sicherungsabtretung">
                  Zustimmung + Sicherungsabtretung
                </option>
                <option value="nur Zustimmung">
                  Nur Zustimmung
                </option>
                <option value="individuell">
                  Individuelle Regelung
                </option>
              </select>
              {errors.unterverm_klausel && (
                <div className="error-text">{errors.unterverm_klausel}</div>
              )}
            </div>

            <div className="form-group">
              <label className="label">
                Tierhaltung - Klauselton{" "}
                <span className="required">*</span>
              </label>
              <select
                className={`select ${errors.tiere_ton ? "error" : ""}`}
                value={formData.tiere_ton}
                onChange={(e) =>
                  updateFormData(
                    "tiere_ton",
                    e.target.value
                  )
                }
              >
                <option value="">Bitte wählen...</option>
                <option value="Standard">
                  Standard (Kleintiere frei, Hunde/Katzen mit
                  Erlaubnis)
                </option>
                <option value="restriktiver">
                  Restriktiver
                </option>
                <option value="individuell">
                  Individuell
                </option>
              </select>
              {errors.tiere_ton && (
                <div className="error-text">{errors.tiere_ton}</div>
              )}
            </div>

            <div className="form-group">
              <label className="label">Weitere Regelungen</label>
              <div className="checkbox-group-v2">
                <label className="checkbox-option-v2">
                  <input
                    type="checkbox"
                    checked={!!formData.bauveraenderung}
                    onChange={(e) =>
                      updateFormData("bauveraenderung", e.target.checked)
                    }
                  />
                  <span>Bauliche Veränderungen</span>
                </label>
                <label className="checkbox-option-v2">
                  <input
                    type="checkbox"
                    checked={!!formData.besichtigung}
                    onChange={(e) =>
                      updateFormData("besichtigung", e.target.checked)
                    }
                  />
                  <span>Besichtigung</span>
                </label>
                <label className="checkbox-option-v2">
                  <input
                    type="checkbox"
                    checked={!!formData.heiz_separat}
                    onChange={(e) =>
                      updateFormData("heiz_separat", e.target.checked)
                    }
                  />
                  <span>Heizung separat</span>
                </label>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div>
            <h2 className="section-title">
              Instandhaltung / SR / Kleinreparaturen
            </h2>

            <div className="sr-info">
              <div className="sr-info-title">
                ⚠️ Schönheitsreparaturen - abhängig vom Zustand
              </div>
              <p className="sr-info-text">
                Die Regelung wird automatisch basierend auf dem "Zustand bei
                Übergabe" aus den Mandantendaten gewählt.
              </p>
            </div>

            <div className="form-group">
              <label className="label">
                Schönheitsreparaturen{" "}
                <span className="required">*</span>
              </label>
              <div className="sr-case-list">
                <div className={srCaseClass(formData.sr_renoviert)}>
                  <div className="sr-case-title">
                    ✓ Fall 1: Renovierte/Neue Wohnung
                  </div>
                  <p className="sr-case-text">
                    Zustand: "renoviert" oder "neu erstellt" → Mieter trägt
                    Schönheitsreparaturen
                  </p>
                  <label className="radio-label sr-case-option">
                    <input
                      type="radio"
                      name="sr_model"
                      checked={formData.sr_renoviert}
                      onChange={() => setSrSelection("sr_renoviert")}
                    />
                    <span>Mieter trägt SR (feste Klausel wird eingefügt)</span>
                  </label>
                </div>

                <div className={srCaseClass(formData.sr_unrenoviert_ohne)}>
                  <div className="sr-case-title">
                    Fall 2a: Unrenoviert - Keine SR-Pflicht
                  </div>
                  <p className="sr-case-text">
                    Zustand: "gebraucht/vertragsgemäß" → Keine SR, aber
                    Beteiligung bei Verschlechterung
                  </p>
                  <label className="radio-label sr-case-option">
                    <input
                      type="radio"
                      name="sr_model"
                      checked={formData.sr_unrenoviert_ohne}
                      onChange={() => setSrSelection("sr_unrenoviert_ohne")}
                    />
                    <span>
                      Keine SR-Pflicht + hälftige Beteiligung bei erheblicher
                      Verschlechterung
                    </span>
                  </label>
                </div>

                <div className={srCaseClass(formData.sr_unrenoviert_mit)}>
                  <div className="sr-case-title">
                    Fall 2b: Unrenoviert - Renovierung gegen Ausgleich
                  </div>
                  <p className="sr-case-text">
                    Zustand: "gebraucht/vertragsgemäß" → Mieter renoviert gegen
                    Kompensation
                  </p>
                  <label className="radio-label sr-case-option">
                    <input
                      type="radio"
                      name="sr_model"
                      checked={formData.sr_unrenoviert_mit}
                      onChange={() => setSrSelection("sr_unrenoviert_mit")}
                    />
                    <span>
                      Mieter renoviert gegen Ausgleich (wählen Sie eine Option)
                    </span>
                  </label>

                  <div className="sr-case-nested">
                    <label className="radio-label sr-case-suboption">
                      <input
                        type="radio"
                        name="sr_ausgleich"
                        value="zuschuss"
                        checked={formData.sr_ausgleich_option === "zuschuss"}
                        onChange={(e) => setSrAusgleichOption(e.target.value)}
                        disabled={!formData.sr_unrenoviert_mit}
                      />
                      <span>Option i) Einmaliger Kostenzuschuss vom Vermieter</span>
                    </label>
                    <div className="sr-case-field">
                      <label className="label">Betrag (EUR)</label>
                      <input
                        type="text"
                        className={`input ${errors.sr_ausgleich_betrag ? "error" : ""}`}
                        placeholder="z.B. 2500"
                        value={formData.sr_ausgleich_betrag}
                        onChange={(e) =>
                          updateFormData("sr_ausgleich_betrag", e.target.value)
                        }
                        disabled={
                          !formData.sr_unrenoviert_mit ||
                          formData.sr_ausgleich_option !== "zuschuss"
                        }
                      />
                      <p className="help-text">Höhe des Zuschusses für Renovierungskosten</p>
                      {errors.sr_ausgleich_betrag && (
                        <div className="error-text">{errors.sr_ausgleich_betrag}</div>
                      )}
                    </div>

                    <label className="radio-label sr-case-suboption">
                      <input
                        type="radio"
                        name="sr_ausgleich"
                        value="mietfrei"
                        checked={formData.sr_ausgleich_option === "mietfrei"}
                        onChange={(e) => setSrAusgleichOption(e.target.value)}
                        disabled={!formData.sr_unrenoviert_mit}
                      />
                      <span>Option ii) Mietfreiheit für X Monate</span>
                    </label>
                    <div className="sr-case-field">
                      <label className="label">Anzahl Monate</label>
                      <input
                        type="text"
                        className={`input ${errors.sr_ausgleich_monate ? "error" : ""}`}
                        placeholder="z.B. 2"
                        value={formData.sr_ausgleich_monate}
                        onChange={(e) =>
                          updateFormData("sr_ausgleich_monate", e.target.value)
                        }
                        disabled={
                          !formData.sr_unrenoviert_mit ||
                          formData.sr_ausgleich_option !== "mietfrei"
                        }
                      />
                      <p className="help-text">Dauer der Mietfreiheit</p>
                      {errors.sr_ausgleich_monate && (
                        <div className="error-text">{errors.sr_ausgleich_monate}</div>
                      )}
                    </div>

                    {errors.sr_ausgleich_option && (
                      <div className="error-text">{errors.sr_ausgleich_option}</div>
                    )}
                  </div>
                </div>
              </div>
              {errors.sr_renoviert && (
                <div className="error-text">{errors.sr_renoviert}</div>
              )}
            </div>

            <div className="form-group">
              <label className="label">
                Kleinreparaturen - je Vorgang{" "}
                <span className="required">*</span>
              </label>
              <select
                className="select"
                value={formData.kleinrep_je}
                onChange={(e) =>
                  updateFormData(
                    "kleinrep_je",
                    e.target.value
                  )
                }
              >
                <option value="">Bitte wählen...</option>
                <option value="100">100 EUR</option>
                <option value="110">110 EUR</option>
                <option value="120">120 EUR</option>
              </select>
              {errors.kleinrep_je && (
                <div className="error-text">{errors.kleinrep_je}</div>
              )}
            </div>

            <div className="form-group">
              <label className="label">
                Kleinreparaturen - Jahresobergrenze <span className="required">*</span>
              </label>
              <select
                className="select"
                value={formData.kleinrep_jahr}
                onChange={(e) => updateFormData("kleinrep_jahr", e.target.value)}
              >
                <option value="">Bitte wählen...</option>
                <option value="7%">7 % der Jahresmiete</option>
                <option value="8%">8 % der Jahresmiete</option>
                <option value="500">500 EUR fest</option>
              </select>
              {errors.kleinrep_jahr && (
                <div className="error-text">{errors.kleinrep_jahr}</div>
              )}
            </div>

            <div className="form-group">
              <label className="label">
                Endrückgabe-Regel <span className="required">*</span>
              </label>

              <select
                className={`select ${errors.endrueckgabe_regel ? "error" : ""}`}
                value={formData.endrueckgabe_regel}
                onChange={(e) =>
                  updateFormData(
                    "endrueckgabe_regel",
                    e.target.value
                  )
                }
              >
                <option value="">Bitte wählen...</option>
                <option value="vertragsgemäß/sauber">
                  Vertragsgemäß / sauber
                </option>
                <option value="zusätzliche Endarbeiten">
                  Zusätzliche Endarbeiten
                </option>
              </select>

              {errors.endrueckgabe_regel && (
                <div className="error-text">
                  {errors.endrueckgabe_regel}
                </div>
              )}
            </div>

            {formData.endrueckgabe_regel === "zusätzliche Endarbeiten" && (
              <div className="highlight-box">
                <label>
                  Endarbeiten (Liste) <span className="required">*</span>
                </label>
                <textarea
                  className={`textarea ${errors.endarbeiten_liste ? "error" : ""}`}
                  rows="4"
                  value={formData.endarbeiten_liste}
                  onChange={(e) =>
                    updateFormData(
                      "endarbeiten_liste",
                      e.target.value
                    )
                  }
                  placeholder={"z.B.\n1. Wände weiß streichen\n2. Dübellöcher schließen"}
                />
                {errors.endarbeiten_liste && (
                  <div className="error-text">
                    {errors.endarbeiten_liste}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div>
            <h2 className="section-title">
              Haftung & Sonstiges
            </h2>

            <div className="form-group">
              <label className="label">
                Haftung Vermieter (§ 536a){" "}
                <span className="required">*</span>
              </label>
              <select
                className={`select ${errors.haftung_536a ? "error" : ""}`}
                value={formData.haftung_536a}
                onChange={(e) =>
                  updateFormData(
                    "haftung_536a",
                    e.target.value
                  )
                }
              >
                <option value="">Bitte wählen...</option>
                <option value="Ausschluss (außer Leben/Körper/Gesundheit)">
                  Ausschluss (außer
                  Leben/Körper/Gesundheit)
                </option>
                <option value="generisch">
                  Generische Regelung
                </option>
                <option value="individuell">
                  Individuell
                </option>
              </select>
              {errors.haftung_536a && (
                <div className="error-text">{errors.haftung_536a}</div>
              )}
            </div>

            <div className="form-group">
              <label className="label">
                Umgebung / Lärm <span className="required">*</span>
              </label>
              <select
                className={`select ${errors.umgebung_laerm ? "error" : ""}`}
                value={formData.umgebung_laerm}
                onChange={(e) => updateFormData("umgebung_laerm", e.target.value)}
              >
                <option value="">Bitte wählen...</option>
                <option value="aufnehmen">Hinweis auf Lärmquellen aufnehmen</option>
                <option value="nicht aufnehmen">Keine besonderen Hinweise</option>
                <option value="individuell">Individuell</option>
              </select>
              {errors.umgebung_laerm && (
                <div className="error-text">{errors.umgebung_laerm}</div>
              )}
            </div>

            <div className="form-group">
              <label className="label">
                Aufrechnung <span className="required">*</span>
              </label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    value="nur_unbestritten"
                    checked={formData.aufrechnung === "nur_unbestritten"}
                    onChange={(e) => updateFormData("aufrechnung", e.target.value)}
                  />
                  Nur mit unbestrittenen/ rechtskräftigen Forderungen
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    value="erweitert"
                    checked={formData.aufrechnung === "erweitert"}
                    onChange={(e) => updateFormData("aufrechnung", e.target.value)}
                  />
                  Erweiterte Aufrechnung möglich
                </label>
              </div>
              {errors.aufrechnung && (
                <div className="error-text">{errors.aufrechnung}</div>
              )}
            </div>

            <div className="form-group">
              <label className="label">
                Veräußerung während Mietzeit <span className="required">*</span>
              </label>
              <select
                className={`select ${errors.veraeusserung ? "error" : ""}`}
                value={formData.veraeusserung}
                onChange={(e) => updateFormData("veraeusserung", e.target.value)}
              >
                <option value="">Bitte wählen...</option>
                <option value="kuendigungsausschluss">Kündigungsausschluss vereinbaren</option>
                <option value="weitergabe">Vertrag geht über (§ 566 BGB)</option>
                <option value="individuell">Individuelle Regelung</option>
              </select>
              {errors.veraeusserung && (
                <div className="error-text">{errors.veraeusserung}</div>
              )}
            </div>
          </div>
        );

      case 6:
        return (
          <div>
            <h2 className="section-title">
              Anlagen & Prüfung
            </h2>

            <div className="form-group">
              <label className="label">
                Anlagen <span className="required">*</span>
              </label>
              <div className="checkbox-group-v2">
                {["Energieausweis", "Hausordnung", "Übergabeprotokoll", "WEG-Unterlagen", "Sonstige Anlagen"].map(
                  (option) => (
                    <label key={option} className="checkbox-option-v2">
                      <input
                        type="checkbox"
                        checked={formData.anlagen.includes(option)}
                        onChange={() => toggleArrayValue("anlagen", option)}
                      />
                      <span>{option}</span>
                    </label>
                  )
                )}
              </div>
              {errors.anlagen && (
                <div className="error-text">{errors.anlagen}</div>
              )}
            </div>

            <div className="form-group">
              <label className="label">
                Energieausweis{" "}
                <span className="required">*</span>
              </label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    value="informativ"
                    checked={
                      formData.energie_einbindung ===
                      "informativ"
                    }
                    onChange={(e) =>
                      updateFormData(
                        "energie_einbindung",
                        e.target.value
                      )
                    }
                  />
                  Nur informativ
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    value="Kenntnisnahme verpflichtend"
                    checked={
                      formData.energie_einbindung ===
                      "Kenntnisnahme verpflichtend"
                    }
                    onChange={(e) =>
                      updateFormData(
                        "energie_einbindung",
                        e.target.value
                      )
                    }
                  />
                  Kenntnisnahme verpflichtend
                </label>
              </div>
              {errors.energie_einbindung && (
                <div className="error-text">
                  {errors.energie_einbindung}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="label">
                DSGVO-Informationsblatt{" "}
                <span className="required">*</span>
              </label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    value="Ja"
                    checked={formData.dsgvo === "Ja"}
                    onChange={(e) =>
                      updateFormData(
                        "dsgvo",
                        e.target.value
                      )
                    }
                  />
                  Ja - beilegen
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    value="Nein"
                    checked={formData.dsgvo === "Nein"}
                    onChange={(e) =>
                      updateFormData(
                        "dsgvo",
                        e.target.value
                      )
                    }
                  />
                  Nein
                </label>
              </div>
              {errors.dsgvo && (
                <div className="error-text">{errors.dsgvo}</div>
              )}
            </div>

            <div className="form-group">
              <label className="label">
                Bearbeiter{" "}
                <span className="required">*</span>
              </label>
              <input
                type="text"
                className={`input ${errors.bearbeiter ? "error" : ""}`}
                value={formData.bearbeiter}
                onChange={(e) =>
                  updateFormData(
                    "bearbeiter",
                    e.target.value
                  )
                }
                placeholder="z.B. RAin Dr. Müller"
              />
              {errors.bearbeiter && (
                <div className="error-text">{errors.bearbeiter}</div>
              )}
            </div>

            <div className="form-group">
              <label className="label">
                Optionale Kontaktdaten Mieter (nur intern)
              </label>
              <input
                type="text"
                className={`input ${errors.mieter_email ? "error" : ""}`}
                placeholder="Mieter-E-Mail (optional)"
                value={formData.mieter_email}
                onChange={(e) =>
                  updateFormData(
                    "mieter_email",
                    e.target.value
                  )
                }
                style={{ marginBottom: "0.5rem" }}
              />
              {errors.mieter_email && (
                <div className="error-text">{errors.mieter_email}</div>
              )}
              <input
                type="text"
                className={`input ${errors.mieter_telefon ? "error" : ""}`}
                placeholder="Mieter-Telefon (optional)"
                value={formData.mieter_telefon}
                onChange={(e) =>
                  updateFormData(
                    "mieter_telefon",
                    e.target.value
                  )
                }
              />
              {errors.mieter_telefon && (
                <div className="error-text">{errors.mieter_telefon}</div>
              )}
            </div>
          </div>
        );

      case 7:
        return (
          <div>
            <h2 className="section-title">Zusammenfassung</h2>

            <div className="alert alert-info">
              <strong>Finalisierung:</strong> Alle juristischen
              Entscheidungen sind getroffen. Sie können nun die
              Vertragserstellung auslösen.
            </div>

            <div className="summary-section">
              <div className="summary-title">
                Vertragsgestaltung
              </div>
              {formData.vertragsart_final && (
                <div className="summary-field">
                  <span className="summary-label">
                    Vertragsart:
                  </span>
                  <span className="summary-value">
                    {formData.vertragsart_final}
                  </span>
                </div>
              )}
              {formData.kuendigungsverzicht && (
                <div className="summary-field">
                  <span className="summary-label">
                    Kündigungsverzicht (Jahre):
                  </span>
                  <span className="summary-value">
                    {formData.kuendigungsverzicht}
                  </span>
                </div>
              )}
            </div>

            <div className="summary-section">
              <div className="summary-title">
                Miethöhe & BK
              </div>
              {formData.mietanpassung_normalfall && (
                <div className="summary-field">
                  <span className="summary-label">
                    Mietanpassung:
                  </span>
                  <span className="summary-value">
                    {mietanpassungLabels[formData.mietanpassung_normalfall] ||
                      formData.mietanpassung_normalfall}
                  </span>
                </div>
              )}
              {formData.faelligkeit && (
                <div className="summary-field">
                  <span className="summary-label">
                    Fälligkeit:
                  </span>
                  <span className="summary-value">
                    {formData.faelligkeit}
                  </span>
                </div>
              )}
              {formData.mietanpassung_normalfall === "staffel" &&
                formData.staffelmiete_schedule && (
                  <div className="summary-field">
                    <span className="summary-label">Staffelmietplan:</span>
                    <span className="summary-value">
                      {formData.staffelmiete_schedule}
                    </span>
                  </div>
                )}
              {formData.mpb_status && (
                <div className="summary-field">
                  <span className="summary-label">
                    Mietpreisbremse - Status:
                  </span>
                  <span className="summary-value">
                    {mpb_statusLabels[formData.mpb_status] ||
                      formData.mpb_status}
                  </span>
                </div>
              )}
              {formData.mpb_status === "bereits_vermietet" &&
                formData.mpb_vormiet && (
                  <div className="summary-field">
                    <span className="summary-label">
                      Mietpreisbremse - Vormietverhältnis:
                    </span>
                    <span className="summary-value">
                      {mpbVormietLabels[formData.mpb_vormiet] ||
                        formData.mpb_vormiet}
                    </span>
                  </div>
                )}
              {formData.mpb_grenze && (
                <div className="summary-field">
                  <span className="summary-label">
                    Mietpreisbremse - Ergebnis:
                  </span>
                  <span className="summary-value">
                    {mpb_grenzeLabels[formData.mpb_grenze] || formData.mpb_grenze}
                  </span>
                </div>
              )}
              {formData.mpb_grenze === "nein" && formData.mpb_vormiete && (
                <div className="summary-field">
                  <span className="summary-label">Begründung: Vormiete</span>
                  <span className="summary-value">
                    Vormiete war höher
                    {formData.mpb_vormiete_text
                      ? ` (${formData.mpb_vormiete_text} EUR/Monat)`
                      : ""}
                  </span>
                </div>
              )}
              {formData.mpb_grenze === "nein" && formData.mpb_modern && (
                <div className="summary-field">
                  <span className="summary-label">Begründung: Modernisierung</span>
                  <span className="summary-value">
                    {formData.mpb_modern_text || "Modernisierung durchgeführt"}
                  </span>
                </div>
              )}
              {formData.mpb_grenze === "nein" && formData.mpb_erstmiete && (
                <div className="summary-field">
                  <span className="summary-label">Begründung: Erstmiete</span>
                  <span className="summary-value">
                    {formData.mpb_erstmiete_text ||
                      "Erstmiete nach umfassender Modernisierung"}
                  </span>
                </div>
              )}
              {formData.zusatz_bk?.length > 0 && (
                <div className="summary-field">
                  <span className="summary-label">Zusatz-BK-Positionen:</span>
                  <span className="summary-value">
                    {formData.zusatz_bk.join(", ")}
                  </span>
                </div>
              )}
              {formData.weg_text && (
                <div className="summary-field">
                  <span className="summary-label">WEG-Verweis:</span>
                  <span className="summary-value">
                    {formData.weg_text}
                  </span>
                </div>
              )}
              {formData.heizww_paragraph && (
                <div className="summary-field">
                  <span className="summary-label">
                    Heiz-/WW-Regelung:
                  </span>
                  <span className="summary-value">
                    {heizwwLabels[formData.heizww_paragraph] ||
                      formData.heizww_paragraph}
                  </span>
                </div>
              )}
            </div>

            <div className="summary-section">
              <div className="summary-title">Nutzung & Zutritt</div>
              {formData.unterverm_klausel && (
                <div className="summary-field">
                  <span className="summary-label">Untervermietung:</span>
                  <span className="summary-value">
                    {formData.unterverm_klausel}
                  </span>
                </div>
              )}
              {formData.tiere_ton && (
                <div className="summary-field">
                  <span className="summary-label">Tierhaltung:</span>
                  <span className="summary-value">{formData.tiere_ton}</span>
                </div>
              )}
            </div>

            <div className="summary-section">
              <div className="summary-title">
                Instandhaltung
              </div>
              {(formData.sr_renoviert ||
                formData.sr_unrenoviert_ohne ||
                formData.sr_unrenoviert_mit) && (
                  <div className="summary-field">
                    <span className="summary-label">SR-Modell:</span>
                    <span className="summary-value">
                      {formData.sr_renoviert
                        ? "Renoviert übergeben"
                        : formData.sr_unrenoviert_ohne
                          ? "Unrenoviert ohne Ausgleich"
                          : "Unrenoviert mit Ausgleich"}
                    </span>
                  </div>
                )}
              {formData.kleinrep_je && (
                <div className="summary-field">
                  <span className="summary-label">
                    Kleinrep. je Vorgang:
                  </span>
                  <span className="summary-value">
                    {formData.kleinrep_je} EUR
                  </span>
                </div>
              )}
              {formData.kleinrep_jahr && (
                <div className="summary-field">
                  <span className="summary-label">Jahresobergrenze:</span>
                  <span className="summary-value">{formData.kleinrep_jahr}</span>
                </div>
              )}
              {formData.endrueckgabe_regel && (
                <div className="summary-field">
                  <span className="summary-label">Endrückgabe-Regel:</span>
                  <span className="summary-value">
                    {formData.endrueckgabe_regel}
                  </span>
                </div>
              )}
              {formData.endrueckgabe_regel ===
                "zusätzliche Endarbeiten" &&
                formData.endarbeiten_liste && (
                  <div className="summary-field">
                    <span className="summary-label">Endarbeiten:</span>
                    <span className="summary-value">
                      {formatEndarbeitenList(formData.endarbeiten_liste)}
                    </span>
                  </div>
                )}
            </div>

            <div className="summary-section">
              <div className="summary-title">Haftung & Veräußerung</div>
              {formData.haftung_536a && (
                <div className="summary-field">
                  <span className="summary-label">Haftung §536a:</span>
                  <span className="summary-value">{formData.haftung_536a}</span>
                </div>
              )}
              {formData.umgebung_laerm && (
                <div className="summary-field">
                  <span className="summary-label">Umgebung / Lärm:</span>
                  <span className="summary-value">{formData.umgebung_laerm}</span>
                </div>
              )}
              {formData.aufrechnung && (
                <div className="summary-field">
                  <span className="summary-label">Aufrechnung:</span>
                  <span className="summary-value">{formData.aufrechnung}</span>
                </div>
              )}
              {formData.veraeusserung && (
                <div className="summary-field">
                  <span className="summary-label">Veräußerung:</span>
                  <span className="summary-value">{formData.veraeusserung}</span>
                </div>
              )}
            </div>

            <div className="summary-section">
              <div className="summary-title">Prüfung</div>
              {formData.anlagen?.length > 0 && (
                <div className="summary-field">
                  <span className="summary-label">Anlagen:</span>
                  <span className="summary-value">{formData.anlagen.join(", ")}</span>
                </div>
              )}
              {formData.bearbeiter && (
                <div className="summary-field">
                  <span className="summary-label">
                    Bearbeiter:
                  </span>
                  <span className="summary-value">
                    {formData.bearbeiter}
                  </span>
                </div>
              )}
            </div>

            {combinedMasksDownloadHref && (
              <div className="summary-section">
                <div className="summary-title">Datenexport</div>
                <p className="help-text" style={{ marginBottom: "0.75rem" }}>
                  Kombinierte Masken A und B als JSON-Datei speichern.
                </p>
                <a
                  href={combinedMasksDownloadHref}
                  download="masken-a-und-b.json"
                  className="button button-secondary"
                  style={{ width: "100%", textAlign: "center" }}
                >
                  <FileText /> Mask A & B als JSON herunterladen
                </a>
              </div>
            )}

            <div className="alert alert-success" style={{ marginTop: "1.5rem" }}>
              <div className="info-box-v2" style={{ marginBottom: "0.75rem" }}>
                <p style={{ margin: 0 }}>
                  Aktive Vorlage:{" "}
                  {downloadUrl ? (
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontWeight: 600, textDecoration: "underline" }}
                    >
                      Finaler Vertrag
                    </a>
                  ) : (
                    <strong>{TEMPLATE_OPTION.label}</strong>
                  )}
                </p>
              </div>

              {downloadUrl ? (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-success"
                  style={{ width: "100%", textAlign: "center" }}
                >
                  <FileText /> Download öffnen
                </a>
              ) : (
                <button
                  onClick={handleExportFinalJSON}
                  className="button button-success"
                  style={{ width: "100%" }}
                  disabled={isGenerating}
                >
                  <FileText /> Vertrag als Word-Dokument herunterladen
                </button>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="anwalt-page">
      <div className="anwalt-hero">
        <h1>Mietvertragserfassung</h1>
        <p>Anwaltsmaske – Juristische Entscheidungen & Klauselwahl</p>

        <div
          style={{
            display: "flex",
            gap: "10px",
            marginTop: "12px",
            flexWrap: "wrap",
          }}
        >
          <span className="status-pill info">
            Vorlage:{" "}
            {downloadUrl ? (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                Finaler Vertrag
              </a>
            ) : (
              TEMPLATE_OPTION.label
            )}
          </span>
          <span
            className={`status-pill ${showImport
              ? "warning"
              : importStatus === "done"
                ? "success"
                : "info"
              }`}
          >
            {importMessage}
          </span>
          {isGenerating && (
            <span className="status-pill info">
              📤 Vertrag wird erzeugt…
            </span>
          )}
          {downloadUrl && (
            <span className="status-pill success">
              ✅ Download-Link bereit
            </span>
          )}
        </div>
      </div>

      {!showImport && mandantendaten && (
        <div className="form-card-v2" style={{ marginBottom: "16px" }}>
          <div className="anwalt-stepper">
            {steps.map((step, idx) => {
              const isActive = idx === currentStep;
              const isDone = idx < currentStep;
              return (
                <div
                  key={step}
                  className={`anwalt-step ${isActive ? "active" : ""
                    } ${isDone ? "completed" : ""}`}
                >
                  <div className="icon">
                    {isDone ? <Check /> : idx + 1}
                  </div>
                  <div className="labels">
                    <div className="title">{step}</div>
                    <div className="desc">
                      Schritt {idx + 1} von {steps.length}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {apiError && (
        <div className="alert alert-warning">{apiError}</div>
      )}

      {downloadUrl && (
        <div className="alert alert-success">
          <p style={{ marginBottom: "0.5rem", fontWeight: 600 }}>
            Der Vertrag wurde erstellt. Sie können den Download-Link hier
            öffnen:
          </p>
          <a href={downloadUrl} target="_blank" rel="noreferrer">
            {downloadUrl}
          </a>
        </div>
      )}

      <div className="form-card-v2">{renderStep()}</div>

      {!showImport && mandantendaten && (
        <div className="nav-buttons-container">
          <button
            onClick={prevStep}
            disabled={currentStep === 0 || isGenerating}
            className="button button-secondary"
          >
            <ChevronLeft /> Zurück
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={nextStep}
              className="button button-primary"
              style={{ background: "#7c3aed" }}
              disabled={isGenerating}
            >
              Weiter <ChevronRight />
            </button>
          ) : (
            <button
              onClick={handleExportFinalJSON}
              disabled={isGenerating}
              className="button button-success"
            >
              <Check /> Abschließen & Exportieren
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**********************
 * ROOT APP
 **********************/
export default function App() {
  const [currentView, setCurrentView] = useState("mandant");

  return (
    <>
      <nav className="nav">
        <div className="nav-container">
          <h1 className="nav-title">
            Mietvertrag-Erfassung
          </h1>
          <div className="nav-buttons">
            <button
              onClick={() => setCurrentView("mandant")}
              className={
                "nav-button " +
                (currentView === "mandant" ? "active" : "")
              }
            >
              📝 Mandantenmaske
            </button>
            <button
              onClick={() => setCurrentView("anwalt")}
              className={
                "nav-button anwalt " +
                (currentView === "anwalt" ? "active" : "")
              }
            >
              ⚖️ Anwaltsmaske
            </button>
          </div>
        </div>
      </nav>

      {currentView === "mandant" ? (
        <MandantenMaske />
      ) : (
        <AnwaltsMaske />
      )}
    </>
  );
}
