document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('receiptForm');
    const tableBody = document.querySelector('#recordsTable tbody');
    const exportBtn = document.getElementById('exportBtn');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    
    // Inputs
    const expensesCNYInput = document.getElementById('expensesCNY');
    const rateInput = document.getElementById('rate');
    const expensesHKDInput = document.getElementById('expensesHKD');
    const receiptIdInput = document.getElementById('receiptId');
    const imageInput = document.getElementById('receiptImages');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');

    // Load data from local storage
    let records = JSON.parse(localStorage.getItem('receiptRecords')) || [];
    renderTable();
    updateNextReceiptId();

    // Auto-calculate HKD
    function calculateHKD() {
        const cny = parseFloat(expensesCNYInput.value) || 0;
        const rate = parseFloat(rateInput.value) || 0;
        const hkd = cny * rate;
        expensesHKDInput.value = hkd.toFixed(2);
    }

    expensesCNYInput.addEventListener('input', calculateHKD);
    
    rateInput.addEventListener('input', () => {
        calculateHKD();
        
        const newRate = parseFloat(rateInput.value);
        // Only update records if we have a valid positive rate
        if (!isNaN(newRate) && newRate > 0) {
            records.forEach(record => {
                record.rate = newRate;
                record.expensesHKD = parseFloat((record.expensesCNY * newRate).toFixed(2));
            });
            saveData();
            renderTable();
        }
    });

    // Image Preview
    let currentImages = []; // Array of {name, data (base64)}

    imageInput.addEventListener('change', (e) => {
        imagePreviewContainer.innerHTML = '';
        currentImages = [];
        const files = Array.from(e.target.files);

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                
                // Create image object to get dimensions
                const imageObj = new Image();
                imageObj.onload = function() {
                    currentImages.push({
                        name: file.name,
                        data: base64,
                        width: this.width,
                        height: this.height
                    });

                    const img = document.createElement('img');
                    img.src = base64;
                    img.classList.add('preview-thumb');
                    img.title = file.name;
                    imagePreviewContainer.appendChild(img);
                };
                imageObj.src = base64;
            };
            reader.readAsDataURL(file);
        });
    });

    // Handle Form Submit
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const newRecord = {
            id: Date.now(),
            prepaidBy: document.getElementById('prepaidBy').value,
            receiptId: document.getElementById('receiptId').value,
            images: currentImages, // Store images
            date: document.getElementById('date').value,
            category: document.getElementById('category').value,
            quantity: document.getElementById('quantity').value,
            expensesCNY: parseFloat(document.getElementById('expensesCNY').value),
            rate: parseFloat(document.getElementById('rate').value),
            expensesHKD: parseFloat(document.getElementById('expensesHKD').value)
        };

        try {
            records.push(newRecord);
            saveData();
            renderTable();
            form.reset();
            imagePreviewContainer.innerHTML = '';
            currentImages = [];
            
            // Restore default rate and calculate next receipt ID
            document.getElementById('rate').value = newRecord.rate;
            updateNextReceiptId();
        } catch (err) {
            if (err.name === 'QuotaExceededError') {
                alert('Storage full! Images are too large to save locally. Please try fewer or smaller images.');
                records.pop(); // Remove the failed record
            } else {
                console.error(err);
                alert('An error occurred while saving.');
            }
        }
    });

    // Delete Record
    window.deleteRecord = (id) => {
        if(confirm('Are you sure you want to delete this record?')) {
            records = records.filter(record => record.id !== id);
            saveData();
            renderTable();
            updateNextReceiptId();
        }
    };

    function saveData() {
        localStorage.setItem('receiptRecords', JSON.stringify(records));
    }

    function renderTable() {
        tableBody.innerHTML = '';
        records.forEach(record => {
            const row = document.createElement('tr');
            
            // Create image thumbnails HTML
            let imagesHtml = '';
            if (record.images && record.images.length > 0) {
                imagesHtml = '<div class="table-images">';
                record.images.forEach(img => {
                    imagesHtml += `<img src="${img.data}" title="${img.name}" class="table-thumb" onclick="openImage('${img.data}')">`;
                });
                imagesHtml += '</div>';
            } else {
                imagesHtml = 'No images';
            }

            row.innerHTML = `
                <td>${record.prepaidBy}</td>
                <td>${record.receiptId}</td>
                <td>${imagesHtml}</td>
                <td>${record.date}</td>
                <td>${record.category}</td>
                <td>${record.quantity}</td>
                <td>${record.expensesCNY.toFixed(2)}</td>
                <td>${record.rate}</td>
                <td>${record.expensesHKD.toFixed(2)}</td>
                <td>
                    <button class="delete-btn" onclick="deleteRecord(${record.id})">Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Open image in new tab
    window.openImage = (src) => {
        const w = window.open("");
        w.document.write(`<img src="${src}" style="max-width: 100%;">`);
    };

    function updateNextReceiptId() {
        if (records.length === 0) {
            receiptIdInput.value = 'M1';
            return;
        }

        let maxNum = 0;
        const regex = /^M(\d+)$/i;

        records.forEach(r => {
            const match = r.receiptId.match(regex);
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNum) maxNum = num;
            }
        });

        if (maxNum > 0) {
            receiptIdInput.value = `M${maxNum + 1}`;
        } else {
            if(!receiptIdInput.value) receiptIdInput.value = 'M1';
        }
    }

    // Export to Excel
    exportBtn.addEventListener('click', () => {
        if (records.length === 0) {
            alert('No records to export!');
            return;
        }

        const dataToExport = records.map(record => {
            // Format image names for export
            const imageNames = record.images ? record.images.map(i => i.name).join(', ') : '';

            return {
                "Prepaid By": record.prepaidBy,
                "Receipt ID": record.receiptId,
                "Images": imageNames,
                "Date": record.date,
                "Category": record.category,
                "Quantity": record.quantity,
                "Expenses (CNY)": record.expensesCNY,
                "Rate (CNY to HKD)": record.rate,
                "Expenses (HKD)": record.expensesHKD
            };
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Financial Report");

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `CityUHK_Financial_Report_${dateStr}.xlsx`);
    });

    // Export to PDF
    exportPdfBtn.addEventListener('click', () => {
        if (records.length === 0) {
            alert('No records to export!');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text("CityUHK Outward Bound Trip Financial Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 22);

        // Removed "Images" from header as they will be in a separate row
        const tableColumn = ["Prepaid By", "Receipt ID", "Date", "Category", "Qty", "CNY", "Rate", "HKD"];
        const tableRows = [];

        records.forEach(record => {
            // 1. Data Row
            const rowData = [
                record.prepaidBy,
                record.receiptId,
                record.date,
                record.category,
                record.quantity,
                record.expensesCNY.toFixed(2),
                record.rate,
                record.expensesHKD.toFixed(2)
            ];
            tableRows.push(rowData);

            // 2. Image Row (only if images exist)
            if (record.images && record.images.length > 0) {
                tableRows.push([{
                    content: '', 
                    colSpan: 8, 
                    styles: { minCellHeight: 60 }, // Reserve space for images
                    images: record.images // Custom property to access in didDrawCell
                }]);
            }
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 25,
            rowPageBreak: 'avoid',
            didDrawCell: (data) => {
                // Check if this is our special image cell
                if (data.cell.raw && data.cell.raw.images) {
                    const images = data.cell.raw.images;
                    let xOffset = data.cell.x + 5;
                    const yOffset = data.cell.y + 5;
                    const maxHeight = 50; // Max height for images

                    images.forEach(img => {
                        let imgWidth = 50;
                        let imgHeight = 50;

                        // Calculate aspect ratio if dimensions exist
                        if (img.width && img.height) {
                            const ratio = img.width / img.height;
                            imgHeight = maxHeight;
                            imgWidth = imgHeight * ratio;
                        }

                        // Check if image fits in the remaining width
                        if (xOffset + imgWidth < doc.internal.pageSize.width - 14) {
                            try {
                                // Use null for format to let jspdf auto-detect from data URI
                                doc.addImage(img.data, null, xOffset, yOffset, imgWidth, imgHeight);
                                xOffset += imgWidth + 5; // Add gap
                            } catch (e) {
                                console.error("Error adding image to PDF", e);
                            }
                        }
                    });
                }
            }
        });

        const dateStr = new Date().toISOString().split('T')[0];
        doc.save(`CityUHK_Financial_Report_${dateStr}.pdf`);
    });
});