import React, { useEffect, useState, useMemo } from 'react';
import TopBar from '../components/TopBar';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, getDoc, getDocs, doc, deleteDoc, updateDoc, limit, addDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import DeviceCard from '../components/DeviceCard';
import { useToast } from '../components/Toast';

export default function AdminReports() {
  const [logs, setLogs] = useState([]);
  const [securityUsers, setSecurityUsers] = useState([]);
  const [flags, setFlags] = useState([]);
  const [flagsEnriched, setFlagsEnriched] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentsEnriched, setStudentsEnriched] = useState([]);
  const [enrichedLogs, setEnrichedLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [flagsLoading, setFlagsLoading] = useState(false);
  // clockedStudents removed: we keep log-based clock-in rows instead
  const [showPrintChooser, setShowPrintChooser] = useState(false);
  const [mobileView, setMobileView] = useState('logs');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'desc' });
  const toast = useToast();

  // debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const getSortOptions = (view) => {
    if (view === 'flagged') return [
      { key: 'flaggedAt', label: 'Time Flagged' },
      { key: 'status', label: 'Status' },
      { key: 'ownerName', label: 'Student Name' }
    ];
    if (view === 'logs') return [
      { key: 'timeIn', label: 'Time In' },
      { key: 'studentName', label: 'Student Name' }
    ];
    if (view === 'security') return [
      { key: 'name', label: 'Name' },
      { key: 'lastActive', label: 'Last Active' }
    ];
    if (view === 'students') return [
      { key: 'name', label: 'Name' },
      { key: 'registeredDate', label: 'Registered Date' }
    ];
    return [];
  };

  const toggleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      return { key, dir: 'desc' };
    });
  };

  const applySort = (arr, key, dir) => {
    if (!key) return arr;
    return [...arr].sort((a,b) => {
      const va = a[key] ?? '';
      const vb = b[key] ?? '';
      // dates
      const da = (va && (va.toDate || typeof va === 'string' || typeof va === 'number')) ? (va.toDate ? va.toDate().getTime() : new Date(va).getTime()) : null;
      const db = (vb && (vb.toDate || typeof vb === 'string' || typeof vb === 'number')) ? (vb.toDate ? vb.toDate().getTime() : new Date(vb).getTime()) : null;
      if (da !== null && db !== null) return dir === 'asc' ? da - db : db - da;
      if (typeof va === 'string' && typeof vb === 'string') return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return dir === 'asc' ? ('' + va).localeCompare('' + vb) : ('' + vb).localeCompare('' + va);
    });
  };

  useEffect(() => {
    const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.error(err));

    return () => { try { unsub(); } catch(e){} };
    
  }, []);

  // manual refresh for logs (help diagnose missing rows)
  const refreshLogsOnce = async () => {
    setLogsLoading(true);
    try {
      const q = query(collection(db, 'logs'), orderBy('timestamp','desc'), limit(1000));
      const snap = await getDocs(q);
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      toast.add(`Fetched ${snap.size} logs`, { type: 'info' });
    } catch (e) { toast.add('Failed to fetch logs: ' + (e.message || e), { type: 'error' }); }
    finally { setLogsLoading(false); }
  };

  // Reconcile missing flag records: create persistent `flags` docs for any device/log that indicates a flag but has no record
  const reconcileFlags = async (showToast = false) => {
    try {
      setFlagsLoading(true);
      let created = 0;

      // Devices that still have flagged=true
      const dq = query(collection(db, 'devices'), where('flagged', '==', true));
      const dsnap = await getDocs(dq);
      for (const docd of dsnap.docs) {
        const dev = { id: docd.id, ...docd.data() };
        const fq = query(collection(db, 'flags'), where('deviceID', '==', dev.id), limit(1));
        const fsnap = await getDocs(fq);
        if (fsnap.empty) {
          try {
            const key = `${dev.id}::${dev.flaggedSN || '__NONE__'}`;
            await setDoc(doc(db, 'flags', key), {
              deviceID: dev.id,
              ownerUID: dev.ownerUID || null,
              expectedSN: dev.deviceSN || null,
              flaggedSN: dev.flaggedSN || null,
              flagReason: dev.flagReason || null,
              flaggedBy: dev.flaggedBy || null,
              flaggedByName: dev.flaggedByName || null,
              flaggedAt: dev.flaggedAt || serverTimestamp(),
              // Reconciled flags are created as 'open' by default; admin actions should explicitly resolve them
              status: 'open'
            }, { merge: true });
            created += 1;
          } catch (e) { console.error('Failed to set reconciled flag', e); }
        }
      }

      // Logs that indicate mismatches
      const lq = query(collection(db, 'logs'), where('action', '==', 'mismatch'), orderBy('timestamp', 'desc'), limit(1000));
      const lsnap = await getDocs(lq);
      for (const logdoc of lsnap.docs) {
        const log = logdoc.data();
        if (log.flagged || log.flaggedSN) {
          // If flaggedSN exists, try matching both deviceID and flaggedSN, otherwise match by deviceID only
          let fs2;
          try {
            if (log.flaggedSN) {
              const fq2 = query(collection(db, 'flags'), where('deviceID', '==', log.deviceID), where('flaggedSN', '==', log.flaggedSN), limit(1));
              fs2 = await getDocs(fq2);
            } else {
              const fq2 = query(collection(db, 'flags'), where('deviceID', '==', log.deviceID), limit(1));
              fs2 = await getDocs(fq2);
            }
          } catch (qe) {
            console.error('Flag lookup failed for log', logdoc.id, qe);
            fs2 = { empty: true };
          }

          if (!fs2 || fs2.empty) {
            try {
              const key = `${log.deviceID || ''}::${log.flaggedSN || '__NONE__'}`;
              await setDoc(doc(db, 'flags', key), {
                deviceID: log.deviceID || null,
                ownerUID: log.ownerUID || null,
                expectedSN: log.expectedSN || null,
                flaggedSN: log.flaggedSN || null,
                flagReason: log.flagReason || null,
                flaggedBy: log.securityUID || null,
                flaggedByName: log.securityName || null,
                flaggedAt: log.timestamp || serverTimestamp(),
                status: 'open'
              }, { merge: true });
              created += 1;
            } catch (e) { console.error('Failed to set reconciled flag from log', e); }

          }
        }
      }

      // refresh local flags cache
      const rq = query(collection(db, 'flags'), orderBy('flaggedAt', 'desc'), limit(500));
      const rsnap = await getDocs(rq);
      let fetched = rsnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Deduplicate flags by (deviceID + flaggedSN). Prefer open status, else most recent flaggedAt
      const groups = {};
      fetched.forEach(f => {
        const key = `${f.deviceID || ''}::${f.flaggedSN || ''}`;
        groups[key] = groups[key] || [];
        groups[key].push(f);
      });

      let removed = 0;
      for (const key in groups) {
        const list = groups[key];
        if (list.length <= 1) continue;
        // choose keeper
        const opens = list.filter(x => x.status === 'open');
        const candidates = opens.length ? opens : list;
        const keeper = candidates.reduce((a,b) => {
          const ta = a.flaggedAt && a.flaggedAt.toDate ? a.flaggedAt.toDate().getTime() : (a.flaggedAt ? new Date(a.flaggedAt).getTime() : 0);
          const tb = b.flaggedAt && b.flaggedAt.toDate ? b.flaggedAt.toDate().getTime() : (b.flaggedAt ? new Date(b.flaggedAt).getTime() : 0);
          return tb > ta ? b : a;
        });

        // delete the rest
        for (const f of list) {
          if (f.id === keeper.id) continue;
          try {
            await deleteDoc(doc(db, 'flags', f.id));
            removed += 1;
          } catch (e) { console.error('Failed to delete duplicate flag', f.id, e); }
        }
      }

      // refresh flags after dedupe
      const rsnap2 = await getDocs(rq);
      fetched = rsnap2.docs.map(d => ({ id: d.id, ...d.data() }));
      setFlags(fetched);

      if (showToast) toast.add(`Reconciled flags; created ${created} missing records, removed ${removed} duplicates`, { type: 'success' });
      else if (created > 0 || removed > 0) console.info(`Reconciled flags; created ${created} missing records, removed ${removed} duplicates`);
    } catch (e) {
      console.error('Flags reconcile failed', e);
      if (showToast) toast.add('Flags reconcile failed: ' + (e.message || e), { type: 'error' });
    } finally { setFlagsLoading(false); }
  };

  // Run a background reconciliation once when the reports page mounts
  useEffect(() => { reconcileFlags(false); }, []);

  useEffect(() => {
    const q2 = query(collection(db, 'users'), where('role', '==', 'security'));
    const unsub2 = onSnapshot(q2, snap => {
      setSecurityUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // subscribe to persistent flag records (history & status) and dedupe duplicates for UI
    const q3 = query(collection(db, 'flags'), orderBy('flaggedAt', 'desc'));
    const unsub3 = onSnapshot(q3, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // group by deviceID::flaggedSN
      const groups = {};
      docs.forEach(f => {
        const key = `${f.deviceID || ''}::${f.flaggedSN || ''}`;
        groups[key] = groups[key] || [];
        groups[key].push(f);
      });
      const deduped = Object.values(groups).map(list => {
        const opens = list.filter(x => x.status === 'open');
        const candidates = opens.length ? opens : list;
        const keeper = candidates.reduce((a,b) => {
          const ta = a.flaggedAt && a.flaggedAt.toDate ? a.flaggedAt.toDate().getTime() : (a.flaggedAt ? new Date(a.flaggedAt).getTime() : 0);
          const tb = b.flaggedAt && b.flaggedAt.toDate ? b.flaggedAt.toDate().getTime() : (b.flaggedAt ? new Date(b.flaggedAt).getTime() : 0);
          return tb > ta ? b : a;
        });
        return keeper;
      });
      setFlags(deduped);
    });

    const q4 = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsub4 = onSnapshot(q4, snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { try { unsub2(); } catch(e){} try { unsub3(); } catch(e){} try { unsub4(); } catch(e){} };
  }, []);

  // limit the logs snapshot to avoid streaming massive datasets
  useEffect(() => {
    const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(1000));
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.error(err));

    return () => { try { unsub(); } catch(e){} };
  }, []);

  // Enrich logs with owner and security info for table rendering (use cached maps + parallel fetches)
  useEffect(() => {
    let cancelled = false;
    const enrich = async () => {
      setLogsLoading(true);
      try {
        const take = logs.slice(0, 300);
        const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
        const securityMap = Object.fromEntries(securityUsers.map(s => [s.id, s]));

        const missingOwners = new Set();
        const missingSecurities = new Set();

        take.forEach(l => {
          if (l.ownerUID && !studentMap[l.ownerUID]) missingOwners.add(l.ownerUID);
          if (l.securityUID && !securityMap[l.securityUID]) missingSecurities.add(l.securityUID);
        });

        // fetch missing users in parallel
        const ownerFetches = Array.from(missingOwners).map(uid => getDoc(doc(db, 'users', uid)).catch(() => null));
        const securityFetches = Array.from(missingSecurities).map(uid => getDoc(doc(db, 'users', uid)).catch(() => null));
        const ownerSnaps = await Promise.all(ownerFetches);
        const securitySnaps = await Promise.all(securityFetches);

        const missingOwnerMap = {};
        ownerSnaps.forEach(s => { if (s && s.exists()) missingOwnerMap[s.id] = { id: s.id, ...s.data() }; });
        const missingSecurityMap = {};
        securitySnaps.forEach(s => { if (s && s.exists()) missingSecurityMap[s.id] = { id: s.id, ...s.data() }; });

        const out = take.map(l => ({
          ...l,
          owner: l.ownerUID ? (studentMap[l.ownerUID] || missingOwnerMap[l.ownerUID] || null) : null,
          security: l.securityUID ? (securityMap[l.securityUID] || missingSecurityMap[l.securityUID] || null) : null
        }));

        if (!cancelled) setEnrichedLogs(out);
      } catch (e) {
        console.error('Failed to enrich logs', e);
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    };
    enrich();
    return () => { cancelled = true; };
  }, [logs, students, securityUsers]);

  // Enrich flags (persistent flag records) with owner, flaggedBy, and serial owner info
  useEffect(() => {
    let cancelled = false;
    const enrich = async () => {
      setFlagsLoading(true);
      try {
        const take = flags.slice(0, 500);
        const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
        const securityMap = Object.fromEntries(securityUsers.map(s => [s.id, s]));

        // gather unique flagged SNs to do parallel device lookups
        const serials = Array.from(new Set(take.map(f => f.flaggedSN).filter(Boolean)));
        const serialMap = {};

        await Promise.all(serials.map(async sn => {
          try {
            const q = query(collection(db, 'devices'), where('deviceSN', '==', sn), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const found = snap.docs[0].data();
              if (found && found.ownerUID) {
                serialMap[sn] = studentMap[found.ownerUID] || null;
                if (!serialMap[sn]) {
                  try {
                    const us = await getDoc(doc(db, 'users', found.ownerUID));
                    if (us.exists()) serialMap[sn] = { id: us.id, ...us.data() };
                  } catch (ue) { /* ignore */ }
                }
              }
            }
          } catch (e) { /* ignore individual serial failures */ }
        }));

        const out = take.map(f => {
          const owner = f.ownerUID ? (studentMap[f.ownerUID] || null) : null;
          const flaggedBy = f.flaggedBy ? (securityMap[f.flaggedBy] || null) : null;
          const serialOwner = f.flaggedSN ? (serialMap[f.flaggedSN] || null) : null;
          const timeResolved = f.resolvedAt || f.stolenMarkedAt || null;
          return {
            ...f,
            ownerName: owner?.name || owner?.email || null,
            registrationNumber: owner?.registrationNumber || null,
            flaggedByName: flaggedBy?.name || flaggedBy?.email || null,
            serialOwnerName: serialOwner?.name || serialOwner?.email || null,
            flagResolvedAt: timeResolved
          };
        });

        // dedupe enriched flags by deviceID::flaggedSN
        const groups = {};
        out.forEach(f => {
          const key = `${f.deviceID || ''}::${f.flaggedSN || ''}`;
          groups[key] = groups[key] || [];
          groups[key].push(f);
        });
        const deduped = Object.values(groups).map(list => {
          const opens = list.filter(x => x.status === 'open');
          const candidates = opens.length ? opens : list;
          const keeper = candidates.reduce((a,b) => {
            const ta = a.flaggedAt && a.flaggedAt.toDate ? a.flaggedAt.toDate().getTime() : (a.flaggedAt ? new Date(a.flaggedAt).getTime() : 0);
            const tb = b.flaggedAt && b.flaggedAt.toDate ? b.flaggedAt.toDate().getTime() : (b.flaggedAt ? new Date(b.flaggedAt).getTime() : 0);
            return tb > ta ? b : a;
          });
          return keeper;
        });
        if (!cancelled) setFlagsEnriched(deduped);
      } catch (e) {
        console.error('Failed to enrich flags', e);
      } finally {
        if (!cancelled) setFlagsLoading(false);
      }
    };
    enrich();
    return () => { cancelled = true; };
  }, [flags, students, securityUsers]);

  // historic "clockedStudents" table removed; table now derived from logs directly

  // Enrich students with their deviceSNs
  useEffect(() => {
    let cancelled = false;
    const enrichStudents = async () => {
      const out = [];
      for (const s of students) {
        try {
          const q = query(collection(db, 'devices'), where('ownerUID', '==', s.id));
          const snap = await getDocs(q);
          const sns = snap.docs.map(d => d.data().deviceSN).filter(Boolean);
          out.push({ ...s, deviceSNs: sns });
        } catch (e) {
          out.push({ ...s, deviceSNs: [] });
        }
      }
      if (!cancelled) setStudentsEnriched(out);
    };
    enrichStudents();
    return () => { cancelled = true; };
  }, [students]);

  const formatDate = (ts) => {
    if (!ts) return '—';
    if (ts.toDate) return ts.toDate().toLocaleString();
    return new Date(ts).toLocaleString();
  };

  const buildPrintHtml = (type) => {
    let title = '';
    let rows = [];

    if (type === 'logs') {
      title = 'Clock-in Table';
      rows = clockInRows.map(r => ({
        studentName: r.in.owner?.name || '—',
        regNo: r.in.owner?.registrationNumber || '—',
        deviceSN: r.in.expectedSN || r.in.scannedSN || '—',
        securityName: r.in.security?.name || r.in.securityName || '—',
        location: r.in.security?.locationID || '—',
        timeIn: formatDate(r.in.timestamp),
        timeOut: r.out ? formatDate(r.out.timestamp) : '—'
      }));
    }

    if (type === 'flagged') {
      title = 'Flagged Devices';
      rows = flagsEnriched.map(d => ({
        studentName: d.ownerName || '—',
        regNo: d.registrationNumber || '—',
        serialFlagged: d.flaggedSN || '—',
        serialOwner: d.serialOwnerName || '—',
        securityName: d.flaggedByName || '—',
        timeFlagged: formatDate(d.flaggedAt),
        status: d.status || '—',
        timeResolved: d.flagResolvedAt ? formatDate(d.flagResolvedAt) : '—'
      }));
    }

    if (type === 'security') {
      title = 'Security Personnel';
      rows = securityUsers.map(s => ({
        name: s.name || s.email || '—',
        email: s.email || '—',
        location: s.locationID || '—',
        timeStarted: s.shiftStartedAt ? formatDate(s.shiftStartedAt) : '—',
        timeOut: s.lastActive ? formatDate(s.lastActive) : '—'
      }));
    }

    if (type === 'students') {
      title = 'Registered Students';
      rows = studentsEnriched.map(st => ({
        name: st.name || '—',
        regNo: st.registrationNumber || '—',
        email: st.email || '—',
        deviceSN: st.deviceSNs && st.deviceSNs.length ? st.deviceSNs.join(', ') : '—',
        registeredDate: st.createdAt ? (st.createdAt.toDate ? st.createdAt.toDate().toLocaleString() : new Date(st.createdAt).toLocaleString()) : '—'
      }));
    }

    // produce simple html
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const tableRows = rows.map(r => `<tr>${headers.map(h => `<td style="padding:6px;border:1px solid #ddd">${r[h] ?? ''}</td>`).join('')}</tr>`).join('');

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>body{font-family:Arial,Helvetica,sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f7f7f7}</style>
        </head>
        <body onload="window.focus();window.print()">
          <h1>${title}</h1>
          <table>
            <thead><tr>${headers.map(h => `<th style="padding:8px;border:1px solid #ddd">${h}</th>`).join('')}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>`;
  };

  const printType = (type) => {
    const html = buildPrintHtml(type);
    // Use an iframe with srcdoc to avoid navigation restrictions and popup blockers
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        // fallback: open in new window
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, '_blank');
        if (w) {
          setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 20000);
        }
      } finally {
        setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) {} }, 1000);
      }
    };
  };

  const downloadCsv = (type) => {
    let rows = [];
    if (type === 'logs') {
      rows = clockInRows.map(r => ({
        studentName: r.in.owner?.name || '',
        regNo: r.in.owner?.registrationNumber || '',
        deviceSN: r.in.expectedSN || r.in.scannedSN || '',
        securityName: r.in.security?.name || r.in.securityName || '',
        location: r.in.security?.locationID || '',
        timeIn: formatDate(r.in.timestamp),
        timeOut: r.out ? formatDate(r.out.timestamp) : ''
      }));
    }
    if (type === 'flagged') {
      rows = flagsEnriched.map(d => ({
        studentName: d.ownerName || '',
        regNo: d.registrationNumber || '',
        serialFlagged: d.flaggedSN || '',
        serialOwner: d.serialOwnerName || '',
        securityName: d.flaggedByName || '',
        timeFlagged: formatDate(d.flaggedAt),
        status: d.status || '',
        timeResolved: d.flagResolvedAt ? formatDate(d.flagResolvedAt) : ''
      }));
    }
    if (type === 'security') {
      rows = securityUsers.map(s => ({
        name: s.name || s.email || '',
        email: s.email || '',
        location: s.locationID || '',
        timeStarted: s.shiftStartedAt ? formatDate(s.shiftStartedAt) : '',
        lastActive: s.lastActive ? formatDate(s.lastActive) : ''
      }));
    }
    if (type === 'students') {
      rows = studentsEnriched.map(st => ({
        name: st.name || '',
        regNo: st.registrationNumber || '',
        email: st.email || '',
        deviceSN: st.deviceSNs && st.deviceSNs.length ? st.deviceSNs.join('; ') : '',
        registeredDate: st.createdAt ? (st.createdAt.toDate ? st.createdAt.toDate().toLocaleString() : new Date(st.createdAt).toLocaleString()) : ''
      }));
    }

    if (!rows.length) {
      toast.add('No data to export', { type: 'error' });
      return;
    }

    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')].concat(rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-report.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { URL.revokeObjectURL(url); document.body.removeChild(a); } catch(e){} }, 2000);
  };

  // Build clock-in rows: for each 'in' action, find matching 'out' (same device, later, same day)
  const sameDay = (a, b) => {
    try {
      const da = a && a.toDate ? a.toDate() : new Date(a);
      const db = b && b.toDate ? b.toDate() : new Date(b);
      return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
    } catch (e) { return false; }
  };

  const clockInRows = enrichedLogs
    .filter(l => l.action === 'in')
    .sort((a,b) => {
      const ta = a.timestamp && a.timestamp.toDate ? a.timestamp.toDate().getTime() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
      const tb = b.timestamp && b.timestamp.toDate ? b.timestamp.toDate().getTime() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
      return tb - ta;
    })
    .slice(0, 200) // limit
    .map(l => {
      const out = enrichedLogs.find(x => x.deviceID === l.deviceID && x.action === 'out' && x.timestamp && ((x.timestamp.toDate ? x.timestamp.toDate().getTime() : new Date(x.timestamp).getTime()) > (l.timestamp && l.timestamp.toDate ? l.timestamp.toDate().getTime() : (l.timestamp ? new Date(l.timestamp).getTime() : 0))) && sameDay(x.timestamp, l.timestamp));
      return { in: l, out };
    });

  const deleteLog = async (id) => {
    try {
      await deleteDoc(doc(db, 'logs', id));
      toast.add('Log deleted', { type: 'success' });
    } catch (e) { toast.add('Failed to delete log: ' + (e.message || e), { type: 'error' }); }
  };

  const deleteDevice = async (id) => {
    try {
      await deleteDoc(doc(db, 'devices', id));
      toast.add('Device removed', { type: 'success' });
    } catch (e) { toast.add('Failed to delete device: ' + (e.message || e), { type: 'error' }); }
  };

  const deleteFlag = async (id) => {
    try {
      await deleteDoc(doc(db, 'flags', id));
      toast.add('Flag record removed', { type: 'success' });
    } catch (e) { toast.add('Failed to delete flag record: ' + (e.message || e), { type: 'error' }); }
  };

  const deleteUser = async (id) => {
    try {
      await deleteDoc(doc(db, 'users', id));
      toast.add('User removed', { type: 'success' });
    } catch (e) { toast.add('Failed to delete user: ' + (e.message || e), { type: 'error' }); }
  };

  const deleteLogsForOwner = async (ownerId) => {
    try {
      const q = query(collection(db, 'logs'), where('ownerUID', '==', ownerId));
      const snap = await getDocs(q);
      const promises = snap.docs.map(d => deleteDoc(doc(db, 'logs', d.id)));
      await Promise.all(promises);
      toast.add('Deleted logs for owner', { type: 'success' });
    } catch (e) { toast.add('Failed to delete logs: ' + (e.message || e), { type: 'error' }); }
  };

  // Derived and filtered datasets for search + sort + mobile cards
  const filteredLogs = useMemo(() => {
    const items = clockInRows.map(r => ({
      id: r.in.id,
      studentName: r.in.owner?.name || '—',
      regNo: r.in.owner?.registrationNumber || '—',
      deviceSN: r.in.expectedSN || r.in.scannedSN || '—',
      securityName: r.in.security?.name || r.in.securityName || '—',
      location: r.in.security?.locationID || '—',
      timeIn: formatDate(r.in.timestamp),
      timeOut: r.out ? formatDate(r.out.timestamp) : '—'
    }));
    const q = (debouncedQuery || '').toLowerCase();
    const filtered = q ? items.filter(it => Object.values(it).some(v => ('' + v).toLowerCase().includes(q))) : items;
    return applySort(filtered, sortConfig.key, sortConfig.dir);
  }, [clockInRows, debouncedQuery, sortConfig]);

  const filteredFlags = useMemo(() => {
    const items = flagsEnriched.map(d => ({
      id: d.id,
      ownerName: d.ownerName || '',
      regNo: d.registrationNumber || '',
      flaggedSN: d.flaggedSN || '',
      serialOwnerName: d.serialOwnerName || '',
      flaggedByName: d.flaggedByName || '',
      flaggedAt: d.flaggedAt,
      timeFlagged: formatDate(d.flaggedAt),
      status: d.status || '',
      flagResolvedAt: d.flagResolvedAt ? formatDate(d.flagResolvedAt) : ''
    }));
    const q = (debouncedQuery || '').toLowerCase();
    const filtered = q ? items.filter(it => Object.values(it).some(v => ('' + v).toLowerCase().includes(q))) : items;
    return applySort(filtered, sortConfig.key, sortConfig.dir);
  }, [flagsEnriched, debouncedQuery, sortConfig]);

  const filteredSecurity = useMemo(() => {
    const items = securityUsers.map(s => ({
      id: s.id,
      name: s.name || s.email || '',
      email: s.email || '',
      locationID: s.locationID || '',
      timeStarted: s.shiftStartedAt ? formatDate(s.shiftStartedAt) : '',
      lastActive: s.lastActive ? formatDate(s.lastActive) : ''
    }));
    const q = (debouncedQuery || '').toLowerCase();
    const filtered = q ? items.filter(it => Object.values(it).some(v => ('' + v).toLowerCase().includes(q))) : items;
    return applySort(filtered, sortConfig.key, sortConfig.dir);
  }, [securityUsers, debouncedQuery, sortConfig]);

  const filteredStudents = useMemo(() => {
    const items = studentsEnriched.map(st => ({
      id: st.id,
      name: st.name || '',
      regNo: st.registrationNumber || '',
      email: st.email || '',
      deviceSNs: st.deviceSNs && st.deviceSNs.length ? st.deviceSNs.join(', ') : '',
      registeredDate: st.createdAt ? (st.createdAt.toDate ? st.createdAt.toDate().toLocaleString() : new Date(st.createdAt).toLocaleString()) : ''
    }));
    const q = (debouncedQuery || '').toLowerCase();
    const filtered = q ? items.filter(it => Object.values(it).some(v => ('' + v).toLowerCase().includes(q))) : items;
    return applySort(filtered, sortConfig.key, sortConfig.dir);
  }, [studentsEnriched, debouncedQuery, sortConfig]);

  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar title="Admin Reports" links={[{ label: 'Back to Dashboard', onClick: () => window.history.back() }]} />
      {/* spacer to account for fixed TopBar */}
      <div className="h-14 md:h-14" />

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex justify-end">
          <button onClick={() => setShowPrintChooser(true)} className="px-4 py-2 bg-blue-600 text-white rounded">Print</button>
        </div>

        {/* Desktop search */}
        <div className="hidden md:flex items-center gap-2 mb-4">
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search across tables…" className="p-2 rounded border w-64" />
          <div className="flex items-center gap-2">
            <select className="p-2 rounded border" onChange={e => toggleSort(e.target.value)} value={sortConfig.key || ''}>
              <option value="">Sort</option>
              {/* default to flagged options for admin dashboards, users can change per view via mobile or toggle */}
              {getSortOptions('flagged').map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button className="px-3 py-2 rounded border" onClick={() => setSortConfig(s => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))}>{sortConfig.dir === 'asc' ? 'Asc' : 'Desc'}</button>
          </div>
        </div>

        {/* Mobile controls: choose which table to show, search and sort */}
        <div className="md:hidden space-y-2 mb-4">
          <div className="flex gap-2">
            <select value={mobileView} onChange={e => setMobileView(e.target.value)} className="flex-1 p-2 rounded border">
              <option value="logs">Clock-in</option>
              <option value="flagged">Flagged</option>
              <option value="security">Security</option>
              <option value="students">Students</option>
            </select>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search…" className="flex-1 p-2 rounded border" />
          </div>
          <div className="flex gap-2">
            <select className="p-2 rounded border" onChange={e => toggleSort(e.target.value)} value={sortConfig.key || ''}>
              <option value="">Sort</option>
              {getSortOptions(mobileView).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button className="px-3 py-2 rounded border" onClick={() => setSortConfig(s => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))}>{sortConfig.dir === 'asc' ? 'Asc' : 'Desc'}</button>
          </div>
        </div>

        

        <section className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between">
            <h3 className="font-bold mb-2">Clock-in Table</h3>
            <div className="flex items-center gap-2">
              <button onClick={refreshLogsOnce} className="px-3 py-1 bg-gray-200 rounded text-sm">Refresh</button>
            </div>
          </div>
          <div className="overflow-x-auto hidden md:block">
            {logsLoading ? <div className="p-2">Loading logs…</div> : (
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr className="text-left">
                  <th className="p-1 whitespace-normal break-words">Student Name</th>
                  <th className="p-1 whitespace-normal break-words">Reg No</th>
                  <th className="p-1 whitespace-normal break-words">Device SN</th>
                  <th className="p-1 whitespace-normal break-words">Security Name</th>
                  <th className="p-1 whitespace-normal break-words">Location</th>
                  <th className="p-1 whitespace-normal break-words">Time In</th>
                  <th className="p-1 whitespace-normal break-words">Time Out</th>
                  <th className="p-1 whitespace-normal break-words">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(row => (
                  <tr key={row.id} className="border-t">
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{row.studentName || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{row.regNo || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{row.deviceSN || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{row.securityName || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{row.location || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{row.timeIn || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{row.timeOut || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><button onClick={() => deleteLog(row.id)} className="px-1 py-0.5 bg-red-600 text-white rounded text-[10px]">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>

          {/* Mobile cards for logs */}
          <div className="md:hidden">
            {mobileView === 'logs' && (filteredLogs.length ? filteredLogs.map(row => (
              <div key={row.id} className="bg-white p-1 rounded shadow mb-1 w-full max-w-full overflow-hidden">
                <div className="text-[10px] space-y-0.5">
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Student</span><span className="ml-2 truncate max-w-full">{row.studentName || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Reg No</span><span className="ml-2 truncate max-w-full">{row.regNo || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Device SN</span><span className="ml-2 truncate max-w-full">{row.deviceSN || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Security</span><span className="ml-2 truncate max-w-full">{row.securityName || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Time In</span><span className="ml-2 truncate max-w-full">{row.timeIn || '—'}</span></div>
                </div>
                <div className="mt-1 flex justify-end">
                  <button onClick={() => deleteLog(row.id)} className="px-1 py-0.5 bg-red-600 text-white rounded text-[10px]">Delete</button>
                </div>
              </div>
            )) : <div className="p-2">No data</div>)}
          </div>
        </section>




        <section className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between">
            <h3 className="font-bold mb-2">Flagged / Mismatched Devices</h3>
            <div className="flex items-center gap-2">
              <button onClick={async () => {
                try {
                  setFlagsLoading(true);
                  const q = query(collection(db, 'flags'), orderBy('flaggedAt', 'desc'), limit(500));
                  const snap = await getDocs(q);
                  setFlags(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                  toast.add(`Fetched ${snap.size} flag records`, { type: 'info' });
                } catch (e) {
                  toast.add('Failed to refresh flags: ' + (e.message || e), { type: 'error' });
                } finally { setFlagsLoading(false); }
              }} className="px-3 py-1 bg-gray-200 rounded text-sm">Refresh</button>
            </div>
          </div>
          <div className="overflow-x-auto hidden md:block">
            {flagsLoading ? <div className="p-2">Loading flags…</div> : (
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr className="text-left">
                  <th className="p-1 whitespace-normal break-words">Student Name</th>
                  <th className="p-1 whitespace-normal break-words">Reg No</th>
                  <th className="p-1 whitespace-normal break-words">Serial No Flagged</th>
                  <th className="p-1 whitespace-normal break-words">Serial No Owner</th>
                  <th className="p-1 whitespace-normal break-words">Security Name</th>
                  <th className="p-1 whitespace-normal break-words">Time Flagged</th>
                  <th className="p-1 whitespace-normal break-words">Status</th>
                  <th className="p-1 whitespace-normal break-words">Time Resolved</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlags.map(d => (
                  <tr key={d.id} className="border-t">
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{d.ownerName || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{d.registrationNumber || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{d.flaggedSN || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{d.serialOwnerName || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{d.flaggedByName || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{formatDate(d.flaggedAt)}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{d.status || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{d.flagResolvedAt ? formatDate(d.flagResolvedAt) : '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words">
                      <div className="flex gap-2">
                        <button onClick={() => deleteFlag(d.id)} className="px-1 py-0.5 bg-red-600 text-white rounded text-[10px]">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>

          {/* Mobile cards for flags */}
          <div className="md:hidden">
            {mobileView === 'flagged' && (filteredFlags.length ? filteredFlags.map(d => (
              <div key={d.id} className="bg-white p-1 rounded shadow mb-1 w-full max-w-full overflow-hidden">
                <div className="text-[10px] space-y-0.5">
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Student</span><span className="ml-2 truncate max-w-full">{d.ownerName || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Reg No</span><span className="ml-2 truncate max-w-full">{d.registrationNumber || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Serial Flagged</span><span className="ml-2 truncate max-w-full">{d.flaggedSN || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Serial Owner</span><span className="ml-2 truncate max-w-full">{d.serialOwnerName || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Flagged At</span><span className="ml-2 truncate max-w-full">{formatDate(d.flaggedAt)}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Status</span><span className="ml-2 truncate max-w-full">{d.status || '—'}</span></div>
                </div>
                <div className="mt-1 flex justify-end">
                  <button onClick={() => deleteFlag(d.id)} className="px-1 py-0.5 bg-red-600 text-white rounded text-[10px]">Delete</button>
                </div>
              </div>
            )) : <div className="p-2">No data</div>)}
          </div>
        </section>

        <section className="bg-white p-4 rounded shadow">
          <h3 className="font-bold mb-2">Security Personnel</h3>
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr className="text-left">
                  <th className="p-1 whitespace-normal break-words">Name</th>
                  <th className="p-1 whitespace-normal break-words">Email</th>
                  <th className="p-1 whitespace-normal break-words">Location</th>
                  <th className="p-1 whitespace-normal break-words">Time Started</th>
                  <th className="p-1 whitespace-normal break-words">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {filteredSecurity.map(s => (
                  <tr key={s.id} className="border-t">
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{s.name || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{s.email || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{s.locationID || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{s.timeStarted || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{s.lastActive || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><button onClick={() => deleteUser(s.id)} className="px-1 py-0.5 bg-red-600 text-white rounded text-[10px]">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards for security */}
          <div className="md:hidden">
            {mobileView === 'security' && (filteredSecurity.length ? filteredSecurity.map(s => (
              <div key={s.id} className="bg-white p-1 rounded shadow mb-1 w-full max-w-full overflow-hidden">
                <div className="text-[10px] space-y-0.5">
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Name</span><span className="ml-2 truncate max-w-full">{s.name || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Email</span><span className="ml-2 truncate max-w-full">{s.email || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Location</span><span className="ml-2 truncate max-w-full">{s.locationID || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Time Started</span><span className="ml-2 truncate max-w-full">{s.timeStarted || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Last Active</span><span className="ml-2 truncate max-w-full">{s.lastActive || '—'}</span></div>
                </div>
                <div className="mt-1 flex justify-end">
                  <button onClick={() => deleteUser(s.id)} className="px-1 py-0.5 bg-red-600 text-white rounded text-[10px]">Delete</button>
                </div>
              </div>
            )) : <div className="p-2">No data</div>)}
          </div>
        </section>

        <section className="bg-white p-4 rounded shadow">
          <h3 className="font-bold mb-2">Registered Students</h3>
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr className="text-left">
                  <th className="p-1 whitespace-normal break-words">Student Name</th>
                  <th className="p-1 whitespace-normal break-words">Reg No</th>
                  <th className="p-1 whitespace-normal break-words">Email</th>
                  <th className="p-1 whitespace-normal break-words">Device SN(s)</th>
                  <th className="p-1 whitespace-normal break-words">Registered Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(st => (
                  <tr key={st.id} className="border-t">
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{st.name || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{st.regNo || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{st.email || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{st.deviceSNs || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><div className="truncate">{st.registeredDate || '—'}</div></td>
                    <td className="p-1 whitespace-normal break-words"><button onClick={() => deleteUser(st.id)} className="px-1 py-0.5 bg-red-600 text-white rounded text-[10px]">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards for students */}
          <div className="md:hidden">
            {mobileView === 'students' && (filteredStudents.length ? filteredStudents.map(st => (
              <div key={st.id} className="bg-white p-1 rounded shadow mb-1 w-full max-w-full overflow-hidden">
                <div className="text-[10px] space-y-0.5">
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Name</span><span className="ml-2 truncate max-w-full">{st.name || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Reg No</span><span className="ml-2 truncate max-w-full">{st.regNo || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Email</span><span className="ml-2 truncate max-w-full">{st.email || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Device SNs</span><span className="ml-2 truncate max-w-full">{st.deviceSNs || '—'}</span></div>
                  <div className="flex justify-between items-center py-0.5 min-w-0"><span className="text-[10px] text-gray-600 font-semibold">Registered</span><span className="ml-2 truncate max-w-full">{st.registeredDate || '—'}</span></div>
                </div>
                <div className="mt-1 flex justify-end">
                  <button onClick={() => deleteUser(st.id)} className="px-1 py-0.5 bg-red-600 text-white rounded text-[10px]">Delete</button>
                </div>
              </div>
            )) : <div className="p-2">No data</div>)}
          </div>
        </section>

        {showPrintChooser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded max-w-sm w-full">
              <h3 className="text-lg font-bold mb-3">Print Report</h3>
              <p className="mb-3 text-sm text-gray-600">Choose which table to print:</p>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => printType('logs')} className="px-3 py-2 bg-blue-600 text-white rounded">Print Clock-in Table</button>
                  <button onClick={() => downloadCsv('logs')} className="px-3 py-2 bg-gray-200 rounded">Download CSV (Clock-in Table)</button>
                  <button onClick={() => printType('flagged')} className="px-3 py-2 bg-blue-600 text-white rounded">Print Flagged</button>
                  <button onClick={() => downloadCsv('flagged')} className="px-3 py-2 bg-gray-200 rounded">Download CSV (Flagged)</button>
                  <button onClick={() => printType('security')} className="px-3 py-2 bg-blue-600 text-white rounded">Print Security</button>
                  <button onClick={() => downloadCsv('security')} className="px-3 py-2 bg-gray-200 rounded">Download CSV (Security)</button>
                  <button onClick={() => printType('students')} className="px-3 py-2 bg-blue-600 text-white rounded">Print Students</button>
                  <button onClick={() => downloadCsv('students')} className="px-3 py-2 bg-gray-200 rounded">Download CSV (Students)</button>

                  <button onClick={() => setShowPrintChooser(false)} className="mt-3 px-3 py-2 bg-gray-200 rounded">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
