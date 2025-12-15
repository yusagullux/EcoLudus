// võtsin stackoverflow'st EXIF andmete lugemiseks
function readEXIFData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const view = new DataView(e.target.result);
            let offset = 0;
            const length = view.byteLength;
            
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

async function readEXIFAdvanced(file) {
    if (typeof EXIF !== 'undefined') {
        return new Promise((resolve) => {
            EXIF.getData(file, function() {
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
    return await readEXIFData(file);
}

const generateImageHash = async (file) => {
    const buffer = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    const arr = Array.from(new Uint8Array(hash));
    return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkHashInDatabase(hash, userId) {
    const key = 'ecoquest_photo_hashes';
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

async function verifyEXIFMetadata(file, questId) {
    const exif = await readEXIFAdvanced(file);
    
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
    
    if (exif.DateTimeOriginal) {
        const photoDate = new Date(exif.DateTimeOriginal);
        const now = new Date();
        const diff = Math.abs(now - photoDate);
        const hours = diff / (1000 * 60 * 60);
        
        if (hours > 24) {
            result.verified = false;
            result.reason = `Photo was taken ${Math.round(hours)} hours ago. Quest must be completed today.`;
            result.severity = 'error';
            return result;
        } else if (hours > 1) {
            result.warnings.push(`Photo was taken ${Math.round(hours)} hours ago.`);
        }
    } else {
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

export async function verifyPhoto(file, quest, userId) {
    const result = {
        verified: false,
        hash: null,
        exif: null,
        errors: [],
        warnings: []
    };
    
    try {
        result.hash = await generateImageHash(file);
        const check = await checkHashInDatabase(result.hash, userId);
        
        if (check.exists && !check.sameUser) {
            result.verified = false;
            result.errors.push('This photo has already been used by another user.');
            return result;
        }
        
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
