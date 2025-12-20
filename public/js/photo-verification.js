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
// Teinud verifitseerimise vähem rangeks, et rohkem pilte läbiks
async function verifyEXIFMetadata(file, questId) {
    const result = {
        verified: true,
        warnings: [],
        exifData: {}
    };

    try {
        const exif = await readEXIFAdvanced(file);
        result.exifData = exif || {};
        
        // Kui EXIF andmed on olemas, kontrollime neid
        if (exif && Object.keys(exif).length > 0) {
            // Kontrollime kuupäeva, kui see on saadaval
            if (exif.DateTimeOriginal) {
                const photoDate = new Date(exif.DateTimeOriginal);
                const now = new Date();
                const diff = Math.abs(now - photoDate);
                const hours = diff / (1000 * 60 * 60);
                
                // Laisem aja kontroll - 48 tundi asemel 72 tundi
                if (hours > 72) {
                    result.warnings.push(`Photo was taken ${Math.round(hours/24)} days ago.`);
                } else if (hours > 24) {
                    result.warnings.push(`Photo was taken ${Math.round(hours/24)} days ago.`);
                }
            } else {
                result.warnings.push('Photo capture date not found in metadata.');
            }
            
            // Lisame asukoha andmed, kui need on saadaval
            if (exif.GPSLatitude && exif.GPSLongitude) {
                result.hasLocation = true;
                result.location = {
                    lat: exif.GPSLatitude,
                    lon: exif.GPSLongitude
                };
            }
            
            // Lisame seadme info, kui see on saadaval
            if (exif.Model || exif.Make) {
                result.device = {
                    make: exif.Make,
                    model: exif.Model
                };
            }
        } else {
            // Kui EXIF andmeid pole, lisame hoiatusse
            result.warnings.push('No EXIF metadata found. Some verification steps were skipped.');
        }
    } catch (error) {
        console.warn('Error reading EXIF data:', error);
        result.warnings.push('Could not read photo metadata. Using basic verification.');
    }
    
    return result;
}

// Peamine funktsioon, mis kontrollib pildi
// Tehtud vähem rangeks ja kasutajasõbralikumaks
export async function verifyPhoto(file, quest, userId) {
    const result = {
        verified: true, // Alustame eeldusega, et pilt on korras
        hash: null,
        exif: null,
        errors: [],
        warnings: []
    };
    
    try {
        // Kontrollime faili tüüpi ja suurust
        if (!file || !(file instanceof File)) {
            result.verified = false;
            result.errors.push('Invalid file. Please select a valid image file.');
            return result;
        }
        
        // Kontrollime faili suurust (max 15MB)
        if (file.size > 15 * 1024 * 1024) {
            result.verified = false;
            result.errors.push('Image is too large. Maximum size is 15MB.');
            return result;
        }
        
        // Kontrollime faili tüüpi
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type.toLowerCase())) {
            result.verified = false;
            result.errors.push('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
            return result;
        }
        
        // Genereerime pildi räsi dubleerimise vältimiseks
        try {
            result.hash = await generateImageHash(file);
            const check = await checkHashInDatabase(result.hash, userId);
            
            // Kui pilt on juba kasutatud teise kasutaja poolt
            if (check.exists && !check.sameUser) {
                result.warnings.push('This photo has been used before. For security, please use a unique photo.');
            }
        } catch (hashError) {
            console.warn('Could not generate image hash:', hashError);
            result.warnings.push('Could not verify image uniqueness. Please ensure this is a unique photo.');
        }
        
        // Kontrollime EXIF andmeid (mitte-blokeeriv)
        try {
            result.exif = await verifyEXIFMetadata(file, quest?.id);
            if (result.exif.warnings && result.exif.warnings.length > 0) {
                result.warnings.push(...result.exif.warnings);
            }
        } catch (exifError) {
            console.warn('Error checking EXIF data:', exifError);
            result.warnings.push('Could not verify photo metadata. Some verification steps were skipped.');
        }
        
        // Salvestame pildi räsi andmebaasi
        if (quest?.id && result.hash) {
            try {
                await saveHashToDatabase(result.hash, userId, quest.id);
            } catch (saveError) {
                console.error('Error saving image hash:', saveError);
                // Ära ebaõnnestumist kasutajale näita, kuna see ei ole kriitiline
            }
        }
        
        return result;
        
    } catch (error) {
        console.error('Photo verification error:', error);
        // Tagastame kasutajasõbraliku veateate
        result.verified = false;
        result.errors.push('An error occurred while verifying your photo. Please try again or use the description option.');
        return result;
    }
}

export function getVerificationMessage(results) {
    if (results.verified) {
        let msg = '✅ Photo Verified!\n\n';
        
        // Kuupäeva kuvamine, kui see on saadaval
        if (results.exif?.exifData?.DateTimeOriginal) {
            const date = new Date(results.exif.exifData.DateTimeOriginal);
            if (!isNaN(date.getTime())) {
                msg += `📅 Taken: ${date.toLocaleString()}\n`;
            }
        }
        
        // Hoiatused
        if (results.warnings.length > 0) {
            msg += '\nℹ️ ' + results.warnings.join('\nℹ️ ');
        }
        
        // Lisame juhise edasi minemiseks
        msg += '\n\nClick "Verify & Continue" to complete your mission.';
        
        return msg;
    } else {
        // Veateated
        let msg = '❌ ' + (results.errors.join('\n\n❌ ') || 'Verification failed. Please try again.');
        
        // Hoiatused
        if (results.warnings.length > 0) {
            msg += '\n\nℹ️ ' + results.warnings.join('\nℹ️ ');
        }
        
        // Abiteave
        msg += '\n\n💡 Tip: Try taking a new photo with your camera instead of using screenshots or downloaded images.';
        
        return msg;
    }
}
