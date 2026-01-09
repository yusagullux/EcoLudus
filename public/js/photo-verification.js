// EXIF andmete lugemine failist
function readEXIFData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const view = new DataView(e.target.result);
                let offset = 0;
                const length = view.byteLength;

                // Kontrolli, kas fail on JPEG (algab 0xFFD8)
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
            } catch (err) {
                console.warn("Error parsing binary EXIF:", err);
                resolve(null);
            }
        };
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(file);
    });
}

// Proovib kasutada EXIF.js teeki, kui saadaval, muidu kasutab readEXIFData
async function readEXIFAdvanced(file) {
    if (typeof EXIF !== 'undefined') {
        return new Promise((resolve) => {
            try {
                EXIF.getData(file, function () {
                    try {
                        const exif = {
                            DateTimeOriginal: EXIF.getTag(this, 'DateTimeOriginal'),
                            GPSLatitude: EXIF.getTag(this, 'GPSLatitude'),
                            GPSLongitude: EXIF.getTag(this, 'GPSLongitude'),
                            Model: EXIF.getTag(this, 'Model'),
                            Make: EXIF.getTag(this, 'Make'),
                            Orientation: EXIF.getTag(this, 'Orientation')
                        };
                        resolve(exif);
                    } catch (e) {
                        resolve(null);
                    }
                });
            } catch (e) {
                resolve(null);
            }
        });
    }
    return await readEXIFData(file);
}

// Genereerib pildi SHA-256 räsi duplikaatide tuvastamiseks
const generateImageHash = async (file) => {
    try {
        const buffer = await file.arrayBuffer();
        const hash = await crypto.subtle.digest('SHA-256', buffer);
        const arr = Array.from(new Uint8Array(hash));
        return arr.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        console.warn("Hashing failed:", e);
        return "hash-error-" + Date.now();
    }
}

// Kontrollib, kas pilt on juba kasutatud
async function checkHashInDatabase(hash, userId) {
    try {
        const key = 'ecoludus_photo_hashes';
        const hashes = JSON.parse(localStorage.getItem(key) || '[]');
        const found = hashes.find(h => h.hash === hash);

        if (found) {
            if (found.userId !== userId) {
                return {
                    exists: true,
                    usedBy: found.userId,
                    usedAt: found.timestamp
                };
            }
            return { exists: false, sameUser: true };
        }

        return { exists: false };
    } catch (e) {
        return { exists: false };
    }
}

// Salvestab pildi räsi andmebaasi
async function saveHashToDatabase(hash, userId, questId) {
    try {
        const storageKey = 'ecoludus_photo_hashes';
        let storedHashes = JSON.parse(localStorage.getItem(storageKey) || '[]');

        storedHashes.push({
            hash: hash,
            userId: userId,
            questId: questId,
            timestamp: new Date().toISOString()
        });

        // Hoia alles viimased 1000
        if (storedHashes.length > 1000) {
            storedHashes = storedHashes.slice(-1000);
        }

        localStorage.setItem(storageKey, JSON.stringify(storedHashes));
    } catch (e) {
        console.warn("Error saving hash:", e);
    }
}

// Kontrollib pildi EXIF metaandmeid
async function verifyEXIFMetadata(file, questId) {
    const result = {
        verified: true,
        warnings: [],
        exifData: {}
    };

    try {
        const exif = await readEXIFAdvanced(file);
        result.exifData = exif || {};

        if (exif && Object.keys(exif).length > 0) {
            // Kontrolli kuupäeva
            if (exif.DateTimeOriginal) {
                const photoDate = new Date(exif.DateTimeOriginal);
                const now = new Date();

                if (!isNaN(photoDate.getTime())) {
                    const diff = Math.abs(now - photoDate);
                    const hours = diff / (1000 * 60 * 60);

                    if (hours > 168) { // 7 päeva
                        result.warnings.push(`Photo was taken ${Math.round(hours / 24)} days ago.`);
                    }
                }
            } else {
                result.warnings.push('Photo capture date not found in metadata.');
            }

            // Lisa asukoha andmed
            if (exif.GPSLatitude && exif.GPSLongitude) {
                result.hasLocation = true;
                result.location = {
                    lat: exif.GPSLatitude,
                    lon: exif.GPSLongitude
                };
            }

            // Lisa seadme info
            if (exif.Model || exif.Make) {
                result.device = {
                    make: exif.Make,
                    model: exif.Model
                };
            }
        } else {
            result.warnings.push('No EXIF metadata found. Some verification steps were skipped.');
        }
    } catch (error) {
        console.warn('Error reading EXIF data:', error);
        result.warnings.push('Could not read photo metadata. Using basic verification.');
    }

    return result;
}

// Peamine foto kontrollimise funktsioon
export async function verifyPhoto(file, quest, userId) {
    const result = {
        verified: true,
        hash: null,
        exif: null,
        errors: [],
        warnings: []
    };

    try {
        // Kontrolli faili olemasolu
        if (!file || !(file instanceof File)) {
            result.verified = false;
            result.errors.push('Invalid file. Please select a valid image file.');
            return result;
        }

        // Kontrolli faili suurust (max 15MB)
        if (file.size > 15 * 1024 * 1024) {
            result.verified = false;
            result.errors.push('Image is too large. Maximum size is 15MB.');
            return result;
        }

        // Kontrolli faili tüüpi
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
        if (!validTypes.includes(file.type.toLowerCase()) && !file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/)) {
            result.verified = false;
            result.errors.push('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
            return result;
        }

        // Genereeri räsi
        try {
            result.hash = await generateImageHash(file);
            const check = await checkHashInDatabase(result.hash, userId);

            if (check.exists && !check.sameUser) {
                result.warnings.push('This photo has been used before. For security, please use a unique photo.');
            }
        } catch (hashError) {
            console.warn('Could not generate image hash:', hashError);
            result.warnings.push('Could not verify image uniqueness. Please ensure this is a unique photo.');
        }

        // Kontrolli EXIF andmeid
        try {
            result.exif = await verifyEXIFMetadata(file, quest?.id);
            if (result.exif.warnings && result.exif.warnings.length > 0) {
                result.warnings.push(...result.exif.warnings);
            }
        } catch (exifError) {
            console.warn('Error checking EXIF data:', exifError);
            result.warnings.push('Could not verify photo metadata. Some verification steps were skipped.');
        }

        // Salvesta räsi
        if (quest?.id && result.hash) {
            try {
                await saveHashToDatabase(result.hash, userId, quest.id);
            } catch (saveError) {
                console.error('Error saving image hash:', saveError);
            }
        }

        return result;

    } catch (error) {
        console.error('Photo verification error:', error);
        result.verified = false;
        result.errors.push('An error occurred while verifying your photo. Please try again or use the description option.');
        return result;
    }
}

// Genereerib kasutajale kuvatava teate
export function getVerificationMessage(results) {
    if (results.verified) {
        let msg = '✅ Photo Verified!\n\n';

        if (results.exif?.exifData?.DateTimeOriginal) {
            const date = new Date(results.exif.exifData.DateTimeOriginal);
            if (!isNaN(date.getTime())) {
                msg += `📅 Taken: ${date.toLocaleString()}\n`;
            }
        }

        if (results.warnings.length > 0) {
            msg += '\nℹ️ ' + results.warnings.join('\nℹ️ ');
        }

        msg += '\n\nClick "Verify & Continue" to complete your mission.';

        return msg;
    } else {
        let msg = '❌ ' + (results.errors.join('\n\n❌ ') || 'Verification failed. Please try again.');

        if (results.warnings.length > 0) {
            msg += '\n\nℹ️ ' + results.warnings.join('\nℹ️ ');
        }

        msg += '\n\n💡 Tip: Try taking a new photo with your camera instead of using screenshots or downloaded images.';

        return msg;
    }
}
