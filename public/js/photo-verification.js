// võtsin stackoverflow'st EXIF andmete lugemiseks
// Esimesel katsel proovisin lihtsalt file.read() aga see ei töötanud
// Siis leidsin, et pean kasutama FileReader API-d
// Proovisin ka EXIF.js teeki, aga see ei töötanud kõigil telefonidel
// See on keeruline kood, aga see töötab!
function readEXIFData(file) {
    return new Promise((resolve, reject) => {
        // Alguses proovisin ilma Promise'ita, aga see ei töötanud
        // Õppisin, et FileReader on asünkroonne ja vajab Promise'i
        const reader = new FileReader();
        reader.onload = function(e) {
            // DataView on vajalik, et lugeda binaarandmeid
            // Esimesel katsel proovisin lihtsalt string'ina, aga see ei töötanud
            const view = new DataView(e.target.result);
            let offset = 0;
            const length = view.byteLength;
            
            // Kontrollin, kas see on JPEG fail (algab 0xFFD8-ga)
            // Kui ei ole, siis ei ole EXIF andmeid
            // Proovisin ka PNG ja GIF, aga need ei toeta EXIF'i nii hästi
            if (view.getUint16(offset) !== 0xFFD8) {
                resolve(null);
                return;
            }
            
            offset += 2;
            const exifData = {};
            
            while (offset < length - 1) {
                if (view.getUint16(offset) === 0xFFE1) {
                    const segmentLength = view.getUint16(offset + 2);
                    const segmentData = new Uint8Array(view.buffer, offset + 4, segmentLength - 2);
                    
                    const exifHeader = String.fromCharCode.apply(null, segmentData.slice(0, 6));
                    if (exifHeader === 'Exif\x00\x00') {
                        try {
                            const dataString = String.fromCharCode.apply(null, segmentData);
                            const dateMatch = dataString.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
                            if (dateMatch) {
                                exifData.DateTimeOriginal = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]} ${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}`;
                            }
                        } catch (err) {
                            console.warn('EXIF parsing error:', err);
                        }
                    }
                    offset += segmentLength + 2;
                } else {
                    offset += 2;
                }
            }
            
            resolve(exifData);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// See funktsioon proovib kõigepealt kasutada EXIF.js teeki
// Kui see ei ole laetud, siis kasutab oma funktsiooni
// Alguses proovisin ainult ühte meetodit, aga see ei töötanud kõigil seadmetel
async function readEXIFAdvanced(file) {
    // Kontrollin, kas EXIF.js on laetud
    // Esimesel katsel unustasin seda kontrollida ja sain errorit.
    if (typeof EXIF !== 'undefined') {
        return new Promise((resolve) => {
            // EXIF.js on lihtsam kasutada, aga ei tööta alati
            EXIF.getData(file, function() {
                // Proovisin alguses ainult DateTimeOriginal'i, aga siis lisasin ka teised väljad
                const exif = {
                    DateTimeOriginal: EXIF.getTag(this, 'DateTimeOriginal'),
                    GPSLatitude: EXIF.getTag(this, 'GPSLatitude'),
                    GPSLongitude: EXIF.getTag(this, 'GPSLongitude'),
                    Model: EXIF.getTag(this, 'Model'),
                    Make: EXIF.getTag(this, 'Make'),
                    Orientation: EXIF.getTag(this, 'Orientation')
                };
                resolve(exif);
            });
        });
    }
    // Kui EXIF.js ei ole, siis kasutan oma funktsiooni
    // See on tagavara variant
    return await readEXIFData(file);
}

// See funktsioon loob pildile koodi, et kontrollida, kas sama pilt on juba kasutatud
// Alguses proovisin lihtsalt file.name'i kasutada, aga see ei töötanud (failinimi võib olla sama)
// Siis leidsin crypto.subtle.digest() meetodi
// Esimesel katsel unustasin await'i ja sain errorit
const generateImageHash = async (file) => {
    // Pean esmalt saama ArrayBuffer'i
    // Proovisin ka file.text(), aga see ei töötanud piltide jaoks
    const buffer = await file.arrayBuffer();
    // SHA-256 on turvaline koodialgoritm
    // Proovisin ka MD5'd, aga see on vananenud
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    // Teisendan koodi hex string'iks
    // Esimesel katsel proovisin lihtsalt toString(16), aga see ei andnud õiget formaati
    const arr = Array.from(new Uint8Array(hash));
    return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Kontrollib, kas sama pilt on juba kasutatud
// Alguses proovisin salvestada Firestore'i, aga see oli liiga aeglane
// Siis leidsin localStorage'i, mis on kiirem
// Esimesel katsel unustasin kontrollida, kas localStorage on tühi
async function checkHashInDatabase(hash, userId) {
    const key = 'ecoquest_photo_hashes';
    // || '[]' tagab, et kui localStorage on tühi, siis saame tühja massiivi
    // Esimesel katsel sain vea, kui localStorage oli tühi
    const hashes = JSON.parse(localStorage.getItem(key) || '[]');
    // Otsin, kas see hash on juba olemas
    // Proovisin ka for loop'i, aga find() on lihtsam
    const found = hashes.find(h => h.hash === hash);
    
    if (found) {
        // Kontrollin, kas sama kasutaja kasutab sama pilti uuesti
        // See on lubatud (nt kui ta teeb sama quest'i uuesti)
        if (found.userId !== userId) {
            return {
                exists: true,
                usedBy: found.userId,
                usedAt: found.timestamp
            };
        }
        // Sama kasutaja võib sama pildi uuesti kasutada
        return { exists: false, sameUser: true };
    }
    
    return { exists: false };
}

async function saveHashToDatabase(hash, userId, questId) {
    const storageKey = 'ecoquest_photo_hashes';
    let storedHashes = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    storedHashes.push({
        hash: hash,
        userId: userId,
        questId: questId,
        timestamp: new Date().toISOString()
    });
    
    // hoia alles viimased 1000
    if (storedHashes.length > 1000) {
        storedHashes = storedHashes.slice(-1000);
    }
    
    localStorage.setItem(storageKey, JSON.stringify(storedHashes));
}

// Kontrollib pildi EXIF andmeid, et veenduda, et pilt on tegelikult tehtud
// See on keeruline osa - alguses ei mõistnud, mida EXIF andmed tähendavad
// Õppisin, et EXIF andmed sisaldavad pildi tegemise aega, asukohta jne
async function verifyEXIFMetadata(file, questId) {
    const exif = await readEXIFAdvanced(file);
    
    // Kontrollin, kas EXIF andmed on üldse olemas
    // Mõned pildid (nt screenshot'id) ei sisalda EXIF andmeid
    // Esimesel katsel unustasin seda kontrollida ja sain vea
    if (!exif || Object.keys(exif).length === 0) {
        return {
            verified: false,
            reason: 'EXIF metadata not found. Photo may not have been taken in real-time.',
            severity: 'warning'
        };
    }
    
    const result = {
        verified: true,
        warnings: [],
        exifData: exif
    };
    
    // Kontrollin, kas pilt on tehtud täna
    // Alguses proovisin kontrollida ainult päeva, aga see ei töötanud hästi
    // Siis leidsin, et pean kontrollima tunde
    if (exif.DateTimeOriginal) {
        const photoDate = new Date(exif.DateTimeOriginal);
        const now = new Date();
        // Arvutan erinevuse millisekundites
        // Esimesel katsel proovisin lihtsalt photoDate - now, aga see andis negatiivse arvu
        const diff = Math.abs(now - photoDate);
        // Teisendan tundideks (1000ms * 60s * 60min = 1 tund)
        // See oli raske arvutada esimesel katsel!
        const hours = diff / (1000 * 60 * 60);
        
        // Kui pilt on vanem kui 24 tundi, siis see ei ole lubatud
        // Alguses panin piiriks 12 tundi, aga see oli liiga range
        if (hours > 24) {
            result.verified = false;
            result.reason = `Photo was taken ${Math.round(hours)} hours ago. Quest must be completed today.`;
            result.severity = 'error';
            return result;
        } else if (hours > 1) {
            // Kui pilt on vanem kui 1 tund, siis annan hoiatus
            // See on ok, aga kasutaja peaks teadma
            result.warnings.push(`Photo was taken ${Math.round(hours)} hours ago.`);
        }
    } else {
        // Kui kuupäeva pole, siis annan hoiatus
        // Alguses keelasin seda täielikult, aga see oli liiga range
        result.warnings.push('Photo capture date not found.');
    }
    
    if (exif.GPSLatitude && exif.GPSLongitude) {
        result.hasLocation = true;
        result.location = {
            lat: exif.GPSLatitude,
            lon: exif.GPSLongitude
        };
    }
    
    if (exif.Model || exif.Make) {
        result.device = {
            make: exif.Make,
            model: exif.Model
        };
    }
    
    return result;
}

// Peamine funktsioon, mis kontrollib pildi
// See on keeruline, sest pean kontrollima mitut asja
// Alguses proovisin kontrollida ainult ühte asja korraga, aga see ei töötanud hästi
export async function verifyPhoto(file, quest, userId) {
    const result = {
        verified: false,
        hash: null,
        exif: null,
        errors: [],
        warnings: []
    };
    
    try {
        // Esmalt loon pildi räsi
        // Alguses proovisin seda viimaseks jätta, aga see oli vale järjekord
        result.hash = await generateImageHash(file);
        // Kontrollin, kas see pilt on juba kasutatud
        // Esimesel katsel unustasin await'i ja sain vea
        const check = await checkHashInDatabase(result.hash, userId);
        
        // Kui pilt on juba kasutatud teise kasutaja poolt, siis see ei ole lubatud
        // Alguses lubasin seda, aga siis mõtlesin, et see võib olla petmine
        if (check.exists && !check.sameUser) {
            result.verified = false;
            result.errors.push('This photo has already been used by another user.');
            return result;
        }
        
        // Kontrollin EXIF andmeid
        // quest?.id on uus süntaks (optional chaining) - õppisin seda hiljem
        // Esimesel katsel proovisin quest.id, aga see andis vea, kui quest oli null
        result.exif = await verifyEXIFMetadata(file, quest?.id);
        if (!result.exif.verified) {
            result.verified = false;
            result.errors.push(result.exif.reason);
            return result;
        }
        
        if (result.exif.warnings && result.exif.warnings.length > 0) {
            result.warnings.push(...result.exif.warnings);
        }
        
        result.verified = true;
        
        if (quest && quest.id) {
            await saveHashToDatabase(result.hash, userId, quest.id);
        }
        
        return result;
    } catch (error) {
        console.error('Photo verification error:', error);
        result.errors.push(`Verification error: ${error.message}`);
        result.verified = false;
        return result;
    }
}

export function getVerificationMessage(results) {
    if (results.verified) {
        let msg = '✅ Photo Verified!\n\n';
        
        if (results.exif && results.exif.exifData && results.exif.exifData.DateTimeOriginal) {
            msg += `📅 Taken: ${results.exif.exifData.DateTimeOriginal}\n`;
        }
        
        if (results.warnings.length > 0) {
            msg += `\n⚠️ Warnings:\n${results.warnings.join('\n')}`;
        }
        
        return msg;
    } else {
        let msg = results.errors.join('\n\n');
        if (results.warnings.length > 0) {
            msg += `\n\n⚠️ Warnings:\n${results.warnings.join('\n')}`;
        }
        return msg;
    }
}
