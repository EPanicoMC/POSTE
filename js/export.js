// Modulo Export — generazione Excel e PDF
const Export = (() => {

  function excel() {
    const data = Report.getMonthData();
    if (data.daysWorked === 0) {
      App.showToast('Nessun dato da esportare', 'error');
      return;
    }

    const rows = [];

    // Header
    rows.push(['Report Timbrature', '', '', '']);
    rows.push([`${data.monthName} ${data.year}`, '', '', '']);
    rows.push([]);
    rows.push(['Giorno', 'Timbrature', 'Ore Nette', 'Delta']);

    // Dati giornalieri
    data.rows.forEach(row => {
      if (!row.hasData) return;
      const stampsStr = row.stamps.map(s => `${s.tipo === 'entrata' ? 'E' : 'U'}: ${s.ora}`).join(' | ');
      const deltaStr = `${row.delta >= 0 ? '+' : ''}${Storage.formatMinutes(row.delta)}`;
      rows.push([
        `${row.dayName} ${row.dayNum}`,
        stampsStr,
        Storage.formatMinutes(row.netMins),
        deltaStr
      ]);
    });

    // Riepilogo
    rows.push([]);
    rows.push(['RIEPILOGO', '', '', '']);
    rows.push(['Ore Totali', Storage.formatMinutes(data.totalMins), '', '']);
    rows.push(['Media Giornaliera', Storage.formatMinutes(data.avgMins), '', '']);
    rows.push(['Delta Totale', `${data.totalDelta >= 0 ? '+' : ''}${Storage.formatMinutes(data.totalDelta)}`, '', '']);
    rows.push(['Giorni Lavorati', `${data.daysWorked}/${data.totalWorkDays}`, '', '']);
    rows.push(['Giorni in Soglia', `${data.daysAbove}`, '', '']);
    rows.push(['Giorni Sotto Soglia', `${data.daysBelow}`, '', '']);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Larghezza colonne
    ws['!cols'] = [
      { wch: 18 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, `${data.monthName} ${data.year}`);
    XLSX.writeFile(wb, `Timbrature_${data.monthName}_${data.year}.xlsx`);
    App.showToast('Excel scaricato', 'success');
  }

  function pdf() {
    const data = Report.getMonthData();
    if (data.daysWorked === 0) {
      App.showToast('Nessun dato da esportare', 'error');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // Colori ufficiali Poste Italiane
    const GIALLO = [243, 216, 41];
    const BLU = [0, 80, 185];
    const GRIGIO = [248, 249, 250];

    // Header con brand Poste Italiane
    doc.setFillColor(...GIALLO);
    doc.rect(0, 0, 210, 28, 'F');

    doc.setFillColor(...BLU);
    doc.rect(0, 28, 210, 4, 'F');

    // Logo testuale
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...BLU);
    doc.text('POSTE ITALIANE', 14, 14);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Report Timbrature', 14, 22);

    // Titolo mese
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${data.monthName} ${data.year}`, 14, 42);

    // Riepilogo
    const summaryStartY = 48;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Ore Totali: ${Storage.formatMinutes(data.totalMins)}`, 14, summaryStartY);
    doc.text(`Media Giornaliera: ${Storage.formatMinutes(data.avgMins)}`, 80, summaryStartY);
    doc.text(`Delta: ${data.totalDelta >= 0 ? '+' : ''}${Storage.formatMinutes(data.totalDelta)}`, 150, summaryStartY);
    doc.text(`Giorni Lavorati: ${data.daysWorked}/${data.totalWorkDays}`, 14, summaryStartY + 6);
    doc.text(`In Soglia: ${data.daysAbove}`, 80, summaryStartY + 6);
    doc.text(`Sotto Soglia: ${data.daysBelow}`, 150, summaryStartY + 6);

    // Tabella
    const tableRows = [];
    data.rows.forEach(row => {
      if (!row.hasData) return;
      const stampsStr = row.stamps.map(s => `${s.tipo === 'entrata' ? 'E' : 'U'}: ${s.ora}`).join('  ');
      const deltaStr = `${row.delta >= 0 ? '+' : ''}${Storage.formatMinutes(row.delta)}`;
      tableRows.push([
        `${row.dayName} ${row.dayNum}`,
        stampsStr,
        Storage.formatMinutes(row.netMins),
        deltaStr
      ]);
    });

    doc.autoTable({
      startY: summaryStartY + 14,
      head: [['Giorno', 'Timbrature', 'Ore Nette', 'Delta']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: BLU,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3
      },
      alternateRowStyles: {
        fillColor: GRIGIO
      },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 80 },
        2: { cellWidth: 28 },
        3: { cellWidth: 28 }
      },
      didParseCell: function(hookData) {
        if (hookData.section === 'body' && hookData.column.index === 3) {
          const val = hookData.cell.raw;
          if (val.startsWith('+')) {
            hookData.cell.styles.textColor = [46, 125, 50];
          } else if (val.startsWith('-')) {
            hookData.cell.styles.textColor = [198, 40, 40];
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFillColor(...BLU);
    doc.rect(0, pageHeight - 12, 210, 12, 'F');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')} — Timbrature Poste`, 14, pageHeight - 5);
    doc.text('Soglia giornaliera: 7h 42m', 150, pageHeight - 5);

    doc.save(`Timbrature_${data.monthName}_${data.year}.pdf`);
    App.showToast('PDF scaricato', 'success');
  }

  return { excel, pdf };
})();
