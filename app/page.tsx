// app/page.tsx
"use client";
import { useState, useRef, ChangeEvent, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx'; // 必要に応じて使う
import Tesseract from 'tesseract.js';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import FrappeGantt, { Task } from 'frappe-gantt';

// Excelデータの型定義を修正 (より具体的な型を定義する)
type ExcelRow = {
    [key: string]: string | number | null | undefined; // 各カラムの型をより具体的に定義
};
type ExcelData = ExcelRow[];

// ガントチャートデータの型定義
type GanttTask = {
    id: string;
    name: string | number;
    start: string;
    end: string;
    progress: number;
    dependencies?: string; // 依存関係
};

// 編集用データ型
type EditableData = ExcelRow;

export default function Home() {
    const [excelData, setExcelData] = useState<ExcelData | null>(null);
    const [ganttData, setGanttData] = useState<GanttTask[] | null>(null);
    const [editableData, setEditableData] = useState<EditableData[]>([]);
    const ganttRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [ocrText, setOcrText] = useState<string>(""); // OCR結果を保持

    const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);

        try {
            const text = await extractTextFromImage(file);
            setOcrText(text); // OCR結果をセット

            console.log(ocrText);

            const data = convertTextToExcelData(text);
            setExcelData(data);

            const { tasks, editData } = createGanttAndEditData(data);
            setGanttData(tasks);
            setEditableData(editData);
        } catch (error) {
            console.error("Error processing image:", error);
        } finally {
            setLoading(false);
        }
    };

    const extractTextFromImage = async (file: File): Promise<string> => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        return new Promise<string>((resolve, reject) => {
            reader.onload = async () => {
                try {
                    const { data: { text } } = await Tesseract.recognize(reader.result as string, 'jpn');
                    resolve(text);

                    console.log(text);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const convertTextToExcelData = useCallback((text: string): ExcelData => {
        const lines = text.split('\n').filter(line => line.trim().length > 0); // 空行を削除
        if (lines.length <= 1) return []; // データがない

        const data: ExcelData = [];
        // 画像に合わせてヘッダーの抽出方法を調整
        const header = lines[0].split(/\s{2,}/).map(h => h.trim()); // 2つ以上のスペースで分割

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(/\s{2,}/).map(v => v.trim());
            if (values.length === 0) continue; // 空行
            
            const row: ExcelRow = {};
            let valueIndex = 0;
            header.forEach(h => {
              if (values[valueIndex]) {
                  row[h] = values[valueIndex];
                  valueIndex++;
                } else {
                  row[h] = null;
                }
            });
            data.push(row);
        }
        console.log(data);
        return data;
    }, []);

    const createGanttAndEditData = useCallback((data: ExcelData): { tasks: GanttTask[], editData: EditableData[] } => {
        const ganttTasks: GanttTask[] = [];
        const editData: EditableData[] = [];
        
        data.forEach((row, index) => {
            if (index > 0 && row.マテハン) { // ヘッダー行をスキップし、必須カラムをチェック
                let name = row.バッチ名 || row.マテハン || `Task ${index}`;
                let startDate: string | undefined = undefined;
                let endDate: string | undefined = undefined;

                // 日付カラムを検索
                for (const key in row) {
                    if (key.match(/\d{1,2}\/\d{1,2}/)) {
                      if (!startDate) startDate = key;
                      else if (!endDate) endDate = key;
                    }
                }

                if (startDate && endDate) {
                    const startIndex = Object.keys(row).indexOf(startDate);
                    const endIndex = Object.keys(row).indexOf(endDate);
                    
                    if (startIndex !== -1 && endIndex !== -1) {
                        const taskDuration = endIndex - startIndex + 1; // タスクの長さを計算
                        const taskStart = new Date(2025, 2, 9 + startIndex).toISOString().split('T')[0]; // 開始日を計算
                        const taskEnd = new Date(2025, 2, 9 + endIndex).toISOString().split('T')[0];   // 終了日を計算
                        const totalPieces = row.ピース ? Number(row.ピース) : 0;
                        const piecePerHour = 33;
                        const workers = row['パート'] ? Number(row['パート'].toString().replace('人', '')) : 1; // パート人数を取得
                        const estimatedDuration = totalPieces / piecePerHour / workers;
                        const progress = (estimatedDuration / taskDuration) * 100;
                        
                        ganttTasks.push({
                            id: String(index),
                            name,
                            start: taskStart,
                            end: taskEnd,
                            progress: Math.min(100, Math.max(0, progress)),
                            dependencies: ''
                        });
                        console.log(ganttTasks);
                    }
                }

                if (!startDate || !endDate) {
                    console.warn(`Task ${index} is missing start or end date, skipping.`);
                    return; // スキップ
                }

                editData.push({ ...row }); // 全行を編集可能にする
            }
        });
        return { tasks: ganttTasks, editData: editData };
    }, []);

    const mapGanttTaskToTask = useCallback((ganttTask: GanttTask): Task => ({
        id: ganttTask.id,
        name: ganttTask.name,
        start: new Date(ganttTask.start),
        end: new Date(ganttTask.end),
        progress: ganttTask.progress,
        dependencies: ganttTask.dependencies,
    }), []);

    const renderGanttChart = useCallback(() => {
        if (ganttRef.current && ganttData) {
            try {
                new FrappeGantt(ganttRef.current, ganttData.map(mapGanttTaskToTask), {
                    header_height: 50,
                    column_width: 20,
                    step: 24,
                    view_modes: ['Day', 'Week', 'Month'],
                    bar_height: 20,
                    bar_corner_radius: 3,
                    arrow_curve: 5,
                    language: 'ja',
                    date_format: 'YYYY-MM-DD',
                    on_date_change: (task: Task, start: Date, end: Date) => {
                        console.log('Task', task, 'の Start: ' + start.toISOString().split('T')[0] + ', End: ' + end.toISOString().split('T')[0]);
                    },
                    on_click: (task: Task) => {
                        console.log(task.name + ' をクリック');
                    },
                });
            } catch (error) {
                console.error("Gantt chart rendering error:", error);
            }
        }
    }, [ganttData, mapGanttTaskToTask]);

    const printGanttChart = async () => {
        if (ganttRef.current) {
            const canvas = await html2canvas(ganttRef.current);
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save('gantt_chart.pdf');
        }
    };

    const handleEditDataChange = (index: number, key: string, value: string | number | null) => {
        const newData = [...editableData];
        newData[index][key] = value;
        setEditableData(newData);

        console.log(newData);

        // 必要に応じて、編集後のデータをガントチャートに反映させる
        if (excelData) {
          const { tasks } = createGanttAndEditData(newData as ExcelData);
          setGanttData(tasks);

          console.log(tasks);
        }
    };

    useEffect(() => {
        if (ganttData) {
            renderGanttChart();
        }
    }, [ganttData, renderGanttChart]);

    return (
        <div>
            <input type="file" accept="image/*" onChange={handleImageUpload} />

            {loading && <div>Loading...</div>}

            {excelData && (
                <div>
                    <h2>Excel Data (Preview)</h2>
                    <table border="1" style={{ borderCollapse: "collapse" }}>
                        <thead>
                            <tr>
                                {Object.keys(excelData[0] || {}).map(key => <th key={key}>{key}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {excelData.map((row, index) => (
                                <tr key={index}>
                                    {Object.keys(row || {}).map(key => (
                                        <td key={key}>
                                            {String(row[key])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {editableData.length > 0 && (
                <div>
                    <h2>Edit Data</h2>
                    <table border="1" style={{ borderCollapse: "collapse" }}>
                        <thead>
                            <tr>
                                {Object.keys(editableData[0] || {}).map(key => <th key={key}>{key}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {editableData.map((row, index) => (
                                <tr key={index}>
                                    {Object.keys(row || {}).map(key => (
                                        <td key={key}>
                                            <input value={String(row[key] || '')} onChange={(e) => handleEditDataChange(index, key, e.target.value)} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div ref={ganttRef} style={{ height: "400px" }} />
            <button onClick={printGanttChart}>Print Gantt Chart (PDF)</button>
        </div>
    );
}



// // app/page.tsx
// "use client";
// import { useState, useRef, ChangeEvent, useEffect, useCallback } from 'react';
// import * as XLSX from 'xlsx';
// import Tesseract from 'tesseract.js';
// import html2canvas from 'html2canvas';
// import jsPDF from 'jspdf';
// import FrappeGantt,{ Task } from 'frappe-gantt';
// // import  from "frappe-gantt"
// import { table } from 'console';

// // Excelデータの型定義を修正 (より具体的な型を定義する)
// type ExcelRow = {

//         マテハン?: string;
//         バッチメイ?: string;
//         ゼンタイ?: string;
//         アイテム?: number;
//         ギョウ?: number;
//         ピース?: number;
//         アソート?: string;
//         アイテム_2?: number;
//         ギョウ_2?: number;
//         ピース_2?: number;




//     [key: string]: string | number | null | undefined; // 各カラムの型をより具体的に定義
// };
// type ExcelData = ExcelRow[];

// // ガントチャートデータの型定義
// type GanttTask = {
//     id: string;
//     name: string ;
//     start: string;
//     end: string;
//     progress: number;
//     dependencies?: string; // 依存関係
// };

// // 編集用データ型
// type EditableData = ExcelRow;

// export default function Home() {
//     const [excelData, setExcelData] = useState<ExcelData | null>(null);
//     const [ganttData, setGanttData] = useState<GanttTask[] | null>(null);
//     const [editableData, setEditableData] = useState<EditableData[]>([]);
//     const ganttRef = useRef<HTMLDivElement>(null);
//     const [loading, setLoading] = useState<boolean>(false);
//     const [ocrText, setOcrText] = useState<string>("");

//     console.log(ocrText)

//     const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
//         const file = event.target.files?.[0];
//         if (!file) return;

//         setLoading(true); // ローディング開始

//         try {
//             const text = await extractTextFromImage(file);
//             setOcrText(text);

//             console.log(text);

//             const data = convertTextToExcelData(text); // ExcelDataに変換
//             setExcelData(data);

//             console.log(data)

//             // Excelデータからガントチャート用のデータを生成 & 編集用データ生成
//             const { tasks, editData } = createGanttAndEditData(data);
//             setGanttData(tasks);
//             setEditableData(editData);
//             console.log(tasks)
//             console.log(editData)

//         } catch (error) {
//             console.error("Error processing image:", error);
//             // エラー処理 (例: ユーザーにメッセージを表示)
//         } finally {
//             setLoading(false); // ローディング終了
//         }
//     };

//     const extractTextFromImage = async (file: File): Promise<string> => {
//         const reader = new FileReader();
//         reader.readAsDataURL(file);
//         return new Promise<string>((resolve, reject) => {
//             reader.onload = async () => {
//                 try {
//                     const { data: { text } } = await Tesseract.recognize(reader.result as string, 'jpn');
//                     resolve(text);
//                 } catch (error) {
//                     reject(error);
//                 }
//             };
//             reader.onerror = (error) => reject(error);
//         });
//     };

//     const convertTextToExcelData = useCallback((text:string): ExcelData => {
//         // OCRテキストをExcelData形式に変換する処理
//         // この部分のロジックは、OCR結果の構造に大きく依存します
//         // 例: CSV形式の場合
//         const lines = text.split('\n').filter(line => line.trim().length > 0 );

//        if( lines.length <=1)return[];

//         const data: ExcelData = [];
//         const header = lines[0].split(/\s+/).filter(Boolean);
//         // .map((h) => h.trim());

//         for (let i = 1; i < lines.length; i++) {
//             const values = lines[i].split(/\s+/).filter(Boolean);
//             // .map(v => v.trim());
//             if (values.length === 0) continue; // 行が壊れていたらスキップ

//             const row: ExcelRow = {};
//             let valueIndex = 0;
//             header.forEach(h => {
              
//                 if (values[valueIndex]) {
//                     row[h] = values[valueIndex];
//                     valueIndex++;
//                   } else {
//                     row[h] = null;
//                   }
//             });
//             // for (let j = 0; j < header.length; j++) {
//             //     row[header[j]] = values[j];
//             // }
//             data.push(row);
//             console.log(`Row ${i}`,row);
//         }
//         console.log("Excel Data:", data);
//         return data;
//     },[]);


//     const createGanttAndEditData = useCallback((data: ExcelData): { tasks: GanttTask[], editData: EditableData[] } => {
//       const ganttTasks: GanttTask[] = [];
//       const editData: EditableData[] = [];
      
//       data.forEach((row, index) => {
//           if (index > 0 && row.マテハン) { // ヘッダー行をスキップし、必須カラムをチェック

//             let name = row.バッチ名 || row.マテハン || `Task ${index}`;
//                 let startDate: string | undefined = undefined;
//                 let endDate: string | undefined = undefined;

//               // console.log(name);

//                 // 日付カラムを検索
//                 for (const key in row) {
//                   if (key.match(/\d{1,2}\/\d{1,2}/)) {
//                     if (!startDate) startDate = key;
//                     else if (!endDate) endDate = key;
//                   }
//               }

//               if (startDate && endDate) {
//                   const startIndex = Object.keys(row).indexOf(startDate);
//                   const endIndex = Object.keys(row).indexOf(endDate);
                  
//                   if (startIndex !== -1 && endIndex !== -1) {
//                       const taskDuration = endIndex - startIndex + 1; // タスクの長さを計算
//                       const taskStart = new Date(2025, 2, 9 + startIndex).toISOString().split('T')[0]; // 開始日を計算
//                       const taskEnd = new Date(2025, 2, 9 + endIndex).toISOString().split('T')[0];   // 終了日を計算
//                       const totalPieces = row.ピース ? Number(row.ピース) : 0;
//                       const piecePerHour = 33;
//                       const workers = row['パート'] ? Number(row['パート'].toString().replace('人', '')) : 1; // パート人数を取得
//                       const estimatedDuration = totalPieces / piecePerHour / workers;
//                       const progress = (estimatedDuration / taskDuration) * 100;
                      
//                       ganttTasks.push({
//                           id: String(index),
//                           name,
//                           start: taskStart,
//                           end: taskEnd,
//                           progress: Math.min(100, Math.max(0, progress)),
//                           dependencies: ''
//                       });
//                   }
//               }

//               editData.push({ ...row }); // 全行を編集可能にする
//           }
//       });
//       return { tasks: ganttTasks, editData: editData };
//   }, []);

//   const mapGanttTaskToTask = useCallback((ganttTask: GanttTask): Task => ({
//       id: ganttTask.id,
//       name: ganttTask.name,
//       start: new Date(ganttTask.start),
//       end: new Date(ganttTask.end),
//       progress: ganttTask.progress,
//       dependencies: ganttTask.dependencies,
//   }), []);

//   const renderGanttChart = useCallback(() => {
//       if (ganttRef.current && ganttData) {
//           try {
//               new FrappeGantt(ganttRef.current, ganttData.map(mapGanttTaskToTask), {
//                   header_height: 50,
//                   column_width: 20,
//                   step: 24,
//                   view_modes: ['Day', 'Week', 'Month'],
//                   bar_height: 20,
//                   bar_corner_radius: 3,
//                   arrow_curve: 5,
//                   language: 'ja',
//                   date_format: 'YYYY-MM-DD',
//                   on_date_change: (task: Task, start: Date, end: Date) => {
//                       console.log('Task', task, 'の Start: ' + start.toISOString().split('T')[0] + ', End: ' + end.toISOString().split('T')[0]);
//                   },
//                   on_click: (task: Task) => {
//                       console.log(task.name + ' をクリック');
//                   },
//               });
//           } catch (error) {
//               console.error("Gantt chart rendering error:", error);
//           }
//       }
//   }, [ganttData, mapGanttTaskToTask]);

//   const printGanttChart = async () => {
//       if (ganttRef.current) {
//           const canvas = await html2canvas(ganttRef.current);
//           const imgData = canvas.toDataURL('image/png');
//           const pdf = new jsPDF();
//           const imgProps = pdf.getImageProperties(imgData);
//           const pdfWidth = pdf.internal.pageSize.getWidth();
//           const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
//           pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
//           pdf.save('gantt_chart.pdf');
//       }
//   };

//   const handleEditDataChange = (index: number, key: string, value: string | number | null) => {
//       const newData = [...editableData];
//       newData[index][key] = value;
//       setEditableData(newData);

//       // 必要に応じて、編集後のデータをガントチャートに反映させる
//       if (excelData) {
//         const { tasks } = createGanttAndEditData(newData as ExcelData);
//         setGanttData(tasks);
//       }
//   };

//   useEffect(() => {
//       if (ganttData) {
//           renderGanttChart();
//       }
//   }, [ganttData, renderGanttChart]);

//   return (
//       <div>
//           <input type="file" accept="image/*" onChange={handleImageUpload} />

//           {loading && <div>Loading...</div>}

//           {excelData && (
//               <div>
//                   <h2>Excel Data (Preview)</h2>
//                   <table border="1" style={{ borderCollapse: "collapse" }}>
//                       <thead>
//                           <tr>
//                               {Object.keys(excelData[0] || {}).map(key => <th key={key}>{key}</th>)}
//                           </tr>
//                       </thead>
//                       <tbody>
//                           {excelData.map((row, index) => (
//                               <tr key={index}>
//                                   {Object.keys(row || {}).map(key => (
//                                       <td key={key}>{String(row[key])}</td>
//                                   ))}
//                               </tr>
//                           ))}
//                       </tbody>
//                   </table>
//               </div>
//           )}

//           {editableData.length > 0 && (
//               <div>
//                   <h2>Edit Data</h2>
//                   <table border="1" style={{ borderCollapse: "collapse" }}>
//                       <thead>
//                           <tr>
//                               {Object.keys(editableData[0] || {}).map(key => <th key={key}>{key}</th>)}
//                           </tr>
//                       </thead>
//                       <tbody>
//                           {editableData.map((row, index) => (
//                               <tr key={index}>
//                                   {Object.keys(row || {}).map(key => (
//                                       <td key={key}>
//                                           <input value={String(row[key] || '')} onChange={(e) => handleEditDataChange(index, key, e.target.value)} />
//                                       </td>
//                                   ))}
//                               </tr>
//                           ))}
//                       </tbody>
//                   </table>
//               </div>
//           )}

//           <div ref={ganttRef} style={{ height: "400px" }} />
//           <button onClick={printGanttChart}>Print Gantt Chart (PDF)</button>
//       </div>
//   );
// }
