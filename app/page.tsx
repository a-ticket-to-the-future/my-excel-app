// app/page.tsx
"use client";
import { useState, useRef, ChangeEvent, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import FrappeGantt,{ Task } from 'frappe-gantt';
// import  from "frappe-gantt"
import { table } from 'console';

// Excelデータの型定義を修正 (より具体的な型を定義する)
type ExcelRow = {

        マテハン?: string;
        バッチメイ?: string;
        ゼンタイ?: string;
        アイテム?: number;
        ギョウ?: number;
        ピース?: number;
        アソート?: string;
        アイテム_2?: number;
        ギョウ_2?: number;
        ピース_2?: number;




    [key: string]: string | number | null | undefined; // 各カラムの型をより具体的に定義
};
type ExcelData = ExcelRow[];

// ガントチャートデータの型定義
type GanttTask = {
    id: string;
    name: string ;
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
    const [ocrText, setOcrText] = useState<string>("");

    console.log(ocrText)

    const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true); // ローディング開始

        try {
            const text = await extractTextFromImage(file);
            setOcrText(text);

            console.log(text);

            const data = convertTextToExcelData(text); // ExcelDataに変換
            setExcelData(data);

            console.log(data)

            // Excelデータからガントチャート用のデータを生成 & 編集用データ生成
            const { tasks, editData } = createGanttAndEditData(data);
            setGanttData(tasks);
            setEditableData(editData);
            console.log(tasks)
            console.log(editData)

        } catch (error) {
            console.error("Error processing image:", error);
            // エラー処理 (例: ユーザーにメッセージを表示)
        } finally {
            setLoading(false); // ローディング終了
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
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const convertTextToExcelData = useCallback((text:string): ExcelData => {
        // OCRテキストをExcelData形式に変換する処理
        // この部分のロジックは、OCR結果の構造に大きく依存します
        // 例: CSV形式の場合
        const lines = text.split('\n').filter(line => line.trim().length > 0 );

       if( lines.length <=1)return[];

        const data: ExcelData = [];
        const header = lines[0].split(/\s+/).filter(Boolean);
        // .map((h) => h.trim());

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(/\s+/).filter(Boolean);
            // .map(v => v.trim());
            if (values.length === 0) continue; // 行が壊れていたらスキップ

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
            // for (let j = 0; j < header.length; j++) {
            //     row[header[j]] = values[j];
            // }
            data.push(row);
            console.log(`Row ${i}`,row);
        }
        console.log("Excel Data:", data);
        return data;
    },[]);


    const createGanttAndEditData = useCallback((data: ExcelData): { tasks: GanttTask[], editData: EditableData[] } => {
      const ganttTasks: GanttTask[] = [];
      const editData: EditableData[] = [];
      
      data.forEach((row, index) => {
          if (index > 0 && row.マテハン) { // ヘッダー行をスキップし、必須カラムをチェック

            const lowerCaseRowKeys = Object.keys(row).map((key) => key.toLowerCase());


              let name: string = `Task` + index; // タスク名候補
              if(lowerCaseRowKeys.includes('バッチメイ')){
                  name = String(row['バッチメイ'])
              } else if (lowerCaseRowKeys.includes('ショウミキゲン')){
                  name = String(row['ショウミキゲン'])
              } else if (lowerCaseRowKeys.includes('ピース')){
                  name = String(row['ピース'])

                  
              }

              let start: string = lowerCaseRowKeys.includes('開始') ? String(row['開始']) : '2025-01-01';
              let end: string = lowerCaseRowKeys.includes('終了') ? String(row['終了']) : '2025-01-10';

              if (!start || isNaN(Date.parse(start))){
                  start = "2025-01-01";
              }
              if (!end || isNaN(Date.parse(end))) {
                end = '2025-01-10';
            }

              const progress:number = lowerCaseRowKeys.includes('進捗')
              ? Number(row['進捗'])
              : 50;

              const dependencies: string = lowerCaseRowKeys.includes('依存関係')
                    ? String(row['依存関係'])
                    : '';

                    const task: GanttTask = {
                      id: String(index),
                      name,
                      start,
                      end,
                      progress,
                      dependencies,
                  };

                  console.log(`Task at index ${index}:`, task);

                  ganttTasks.push(task);

                editData.push({ ...row });

              // const date = row.DATE ? new Date(row.DATE) : new Date(2025, 0, 1); // デフォルト日付

              // const start = date.toISOString().split('T')[0]; // YYYY-MM-DD
              // const end = new Date(date.setDate(date.getDate() + 1)).toISOString().split('T')[0]; // 次の日
              
              // if (name && start && end) {
              //     ganttTasks.push({
              //         id: String(index),
              //         name,
              //         start,
              //         end,
              //         progress: row.ピース ? (row.ギョウ_2 ? (Number(row.ギョウ_2) / Number(row.ギョウ)) * 100 : 0) : 0, // 進捗率計算
              //         dependencies: ''
              //     });

              // }

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
         const ganttChartData = ganttData.map(mapGanttTaskToTask);
          // new FrappeGantt(ganttRef.current, ganttData.map(mapGanttTaskToTask);

            console.log("FrappeGantt Data",ganttChartData )
      
          // , {
          //     header_height: 50,
          //     column_width: 20,
          //     step: 24,
          //     view_modes: ['Day', 'Week', 'Month'],
          //     bar_height: 20,
          //     bar_corner_radius: 3,
          //     arrow_curve: 5,
          //     language: 'ja',
          //     date_format: 'YYYY-MM-DD',
          //     on_date_change: (task: Task, start: Date, end: Date) => {
          //         console.log('Task', task, 'の Start: ' + start.toISOString().split('T')[0] + ', End: ' + end.toISOString().split('T')[0]);
          //     },
          //     on_click: (task: Task) => {
          //         console.log(task.name + ' をクリック');
          //     },

          try {
            const gantt = new FrappeGantt(
                ganttRef.current,
                ganttChartData,
                {
                    header_height: 50,
                    column_width: 30,
                    step: 24,
                    view_modes: ['Day', 'Week', 'Month'],
                    bar_height: 20,
                    bar_corner_radius: 3,
                    arrow_curve: 5,
                    language: 'ja',
                    date_format: 'YYYY-MM-DD',
                    on_date_change: (task: Task, start: Date, end: Date) => {
                        console.log('Task', task, 'の Start: ' + start + ', End: ' + end);
                    },
                    on_click: (task: Task) => {
                        console.log(task.name + ' をクリック');
                    },
                }
          );
          console.log(gantt);
      }
      catch(error) {
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

      // 必要に応じて、編集後のデータをガントチャートに反映させる
      if (excelData) {
        const { tasks } = createGanttAndEditData(newData as ExcelData);
        setGanttData(tasks);
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
                                      <td key={key}>{String(row[key])}</td>
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

//     const createGanttAndEditData = (data: ExcelData): { tasks: GanttTask[]; editData: EditableData[]; } => {
//         // Excelデータからガントチャート用のデータを作成
//         // この部分のロジックは、Excelデータの構造に大きく依存します
//         // 例：

//         const ganttTasks: GanttTask[] = [];
//         const editData: EditableData[] = [];

//         data.forEach((row, index) => {
//             if (index > 0) { // ヘッダー行をスキップ
//               const lowerCaseRowKeys = Object.keys(row).map(key => key.toLowerCase());

//               let name : string = "Task " + index;
//               if(lowerCaseRowKeys.includes("タスク名")) {
//                      name = String(row["タスク名"]) 
//               } else if (lowerCaseRowKeys.includes("名称")){
//                 name = String(row["名称"]);
//               } else if (lowerCaseRowKeys.includes("タスク")){
//                  name = String(row["タスク"]);   
//               } else {
//                 name = "Task" + index;
//               }     
//                     //  lowerCaseRowKeys.includes("タスク名") ? String(row["タスク名"]) :
//                     //      lowerCaseRowKeys.includes("名称") ? String(row["名称"]) :
//                     //      lowerCaseRowKeys.includes("タスク") ? String(row["タスク"]) :
//                     //      "Task " + index;

//                 // カラム名に合わせてガントチャートデータを作成 (例: 開始日、終了日のカラム名が "開始", "終了" である場合)
//                 // const start = row["開始"] ? String(row["開始"]) : "2025-01-01"; // デフォルト値
//                 // const end = row["終了"] ? String(row["終了"]) : "2025-01-10";   // デフォルト値

//                 const start = lowerCaseRowKeys.includes("開始") ? String(row["開始"]) : "2025-01-01";
//                 const end = lowerCaseRowKeys.includes("終了") ? String(row["終了"]) : "2025-01-10";
//                 const progress = lowerCaseRowKeys.includes("進捗") ? Number(row["進捗"]) : 50;
//                 const dependencies = lowerCaseRowKeys.includes("依存関係") ? String(row["依存関係"]) : "";
    

//                 ganttTasks.push({
//                     id: String(index),
//                     // name: String(row["タスク名"] || row["名称"] || "Task " + index), // 適切なカラム名を探す
//                     name,
//                     start,
//                     end,
//                     // progress: Number(row["進捗"] || 50), // 仮の値
//                     // dependencies: String(row["依存関係"] || "")
//                     progress,
//                     dependencies,
//                 });

//                 editData.push({ ...row }); // 全行編集可能
//             }
//         });

//         console.log("granttTasks:",ganttTasks)
//         return { tasks: ganttTasks, editData: editData };
//     };

    

// // 必要に応じて、GanttTaskからTaskに変換する関数を作成
// // const mapGanttTaskToTask = (ganttTask: GanttTask): Task => ({
// //   id: ganttTask.id,
// //   name: ganttTask.name,
// //   start: new Date(ganttTask.start),
// //   end: new Date(ganttTask.end),
// //   progress: ganttTask.progress,
// //   dependencies: ganttTask.dependencies,
// //   // ... 他のTaskのプロパティもコピー
// // });


//  // 必要に応じて、GanttTaskからTaskに変換する関数を作成
//  const mapGanttTaskToTask = useCallback(
//   (ganttTask: GanttTask): Task => ({
//       id: ganttTask.id,
//       name: ganttTask.name,
//       start: new Date(ganttTask.start),
//       end: new Date(ganttTask.end),
//       progress: ganttTask.progress,
//       dependencies: ganttTask.dependencies,
//       // ... 他のTaskのプロパティもコピー
//   }),
//   []
// );




//     const renderGanttChart = useCallback(() => {
//         if (ganttRef.current && ganttData) {
//             const gantt = new FrappeGantt(ganttRef.current, ganttData.map(mapGanttTaskToTask), {
//                 // ... Frappe Ganttの設定 (必要に応じてカスタマイズ)
//                 header_height: 50,
//                 column_width: 30,
//                 step: 24,
//                 view_modes: ['Day', 'Week', 'Month'],
//                 // view_modes: [{ id: 'Day', label: '日' }, { id: 'Week', label: '週' }, { id: 'Month', label: '月' }], // より厳密な書き方
//                 bar_height: 20,
//                 bar_corner_radius: 3,
//                 arrow_curve: 5,
//                 language: 'ja',
//                 date_format: 'YYYY-MM-DD',
//                 on_date_change: (task: Task, start: string, end: string) => {
//                   console.log("Task", task, "の Start: " + start + ", End: " + end);
//                 },
//                 on_click: (task: GanttTask) => {
//                   console.log(task.name + " をクリック");
//                 }
//             });
//             // ganttを使用する処理を追加 (例：gantt.change_view('Month'))
//         }
//     },[ganttData, mapGanttTaskToTask]);


//     const printChartAsPDF = async () => {
//         if (ganttRef.current) {
//             const canvas = await html2canvas(ganttRef.current);
//             const imgData = canvas.toDataURL('image/png');
//             const pdf = new jsPDF();
//             const imgProps = pdf.getImageProperties(imgData);
//             const pdfWidth = pdf.internal.pageSize.getWidth();
//             const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
//             pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
//             pdf.save('gantt_chart.pdf');
//         }
//     };

//     // 編集機能
//     const handleEditDataChange = (index: number, key: string, value: string | number | null) => {
//         const newData = [...editableData];
//         newData[index][key] = value;
//         setEditableData(newData);

//         // 編集後のデータからガントチャートデータを再生成 (必要に応じて)
//         if (excelData) {
//           const newGanttTasks = createGanttAndEditData(newData as ExcelData).tasks;
//           setGanttData(newGanttTasks);
//         }

//     };

//     useEffect(() => {
//       if (ganttData) {
//           renderGanttChart();
//       }
//     }, [ganttData, renderGanttChart]);


//     return (
//         <div>
//             <input type="file" accept="image/*" onChange={handleImageUpload} />

//             {loading && <div>Loading...</div>}  {/* ローディング表示 */}

//             {excelData && (
//               <div>
//                  <h2>Excel Data</h2>
//                  {/* 必要に応じてExcelDataの表示、編集機能を作成 */}
//                  {/* 例: テーブル表示、セル編集inputなど */}
//               </div>
//             )}

//             {editableData.length > 0 && (
//                 <div>
//                     <h2>Edit Data</h2>
//                     <table>
//                         <thead>
//                             <tr>
//                                 {Object.keys(editableData[0]).map(key => (
//                                     <th key={key}>{key}</th>
//                                 ))}
//                             </tr>
//                         </thead>
//                         <tbody>
//                             {editableData.map((row, rowIndex) => (
//                                 <tr key={rowIndex}>
//                                     {Object.keys(row).map(key => (
//                                         <td key={key}>
//                                             <input
//                                                 value={String(row[key] || '')}  // null, undefinedを空文字に
//                                                 onChange={e => handleEditDataChange(rowIndex, key, e.target.value)}
//                                             />
//                                         </td>
//                                     ))}
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                 </div>
//             )}

//             <div ref={ganttRef} />
//             <button onClick={printChartAsPDF}>Print Gantt Chart (PDF)</button>
//         </div>
//     );
// }
// // app/page.tsx
// "use client";
// import { useState, useRef, ChangeEvent } from 'react';
// import * as XLSX from 'xlsx';
// import Tesseract from 'tesseract.js';
// import html2canvas from 'html2canvas';
// import jsPDF from 'jspdf';
// import FrappeGantt from 'frappe-gantt';

// // Excelデータの型定義を修正
// type ExcelData = (string | number)[][];

// // ガントチャートデータの型定義
// type GanttTask = {
//     id: string;
//     name: string;
//     start: string;
//     end: string;
//     progress: number;
//     // ... 必要に応じて他のプロパティを追加
// };

// // 編集用データ型
// type EditableData = {
//     [key: string]: string | number;
// };

// export default function Home() {
//     // const [excelData, setExcelData] = useState<ExcelData | null>(null); // 使用していないため削除
//     const [ganttData, setGanttData] = useState<GanttTask[] | null>(null);
//     const [editableData, setEditableData] = useState<EditableData[]>([]);
//     const ganttRef = useRef<HTMLDivElement>(null);

//     const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
//         const file = event.target.files?.[0];
//         if (!file) return;

//         const text = await extractTextFromImage(file);
//         const csv = convertTextToCSV(text);
//         const workbook = XLSX.read(csv, { type: 'string' });
//         const sheetName = workbook.SheetNames[0];
//         const sheet = workbook.Sheets[sheetName];
//         const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as ExcelData;

//         // setExcelData(data); // 使用していないため削除

//         // Excelデータからガントチャート用のデータを生成 & 編集用データ生成
//         const { tasks, editData } = createGanttAndEditData(data);
//         setGanttData(tasks);
//         setEditableData(editData);
//     };

//     const extractTextFromImage = async (file: File): Promise<string> => {
//         const reader = new FileReader();
//         reader.readAsDataURL(file);
//         return new Promise<string>((resolve, reject) => {
//             reader.onload = async () => {
//                 try {
//                     const result = await Tesseract.recognize(reader.result as string, 'jpn');
//                     resolve(result.data.text);
//                 } catch (error) {
//                     reject(error);
//                 }
//             };
//             reader.onerror = (error) => reject(error);
//         });
//     };

//     const convertTextToCSV = (text: string): string => {
//         return text.replace(/\s+/g, ',');
//     };

//     const createGanttAndEditData = (data: ExcelData): { tasks: GanttTask[], editData: EditableData[] } => {
//         // Excelデータからガントチャート用のデータを作成
//         // この部分のロジックは、Excelデータの構造に大きく依存します
//         // 例：
//         const ganttTasks: GanttTask[] = [];
//         const editData: EditableData[] = [];

//         data.forEach((row, index) => {
//             if (index > 0) { // ヘッダー行をスキップ
//                 ganttTasks.push({
//                     id: String(index),
//                     name: String(row[0]),
//                     start: String(row[1]),
//                     end: String(row[2]),
//                     progress: 50, // 仮の値
//                 });

//                 // 編集用データ生成 (例: 全カラムを編集可能にする)
//                 const rowData: EditableData = {};
//                 row.forEach((cell, cellIndex) => {
//                     rowData[String(cellIndex)] = cell;
//                 });
//                 editData.push(rowData);
//             }
//         });
//         return { tasks: ganttTasks, editData: editData };
//     };

//     // const renderGanttChart = () => { ... }; // 使用していないため削除

//     const printChartAsPDF = async () => {
//         if (ganttRef.current) {
//             const canvas = await html2canvas(ganttRef.current);
//             const imgData = canvas.toDataURL('image/png');
//             const pdf = new jsPDF();
//             const imgProps = pdf.getImageProperties(imgData);
//             const pdfWidth = pdf.internal.pageSize.getWidth();
//             const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
//             pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
//             pdf.save('gantt_chart.pdf');
//         }
//     };

//     // 編集機能
//     const handleEditDataChange = (index: number, key: string, value: string | number) => {
//         const newData = [...editableData];
//         newData[index][key] = value;
//         setEditableData(newData);

//         // 編集後のデータからガントチャートデータを再生成 (必要に応じて)
//         const newGanttTasks = createGanttAndEditData(editableData.map(item => Object.values(item)) as ExcelData).tasks;
//         setGanttData(newGanttTasks);
//     };

//     return (
//         <div>
//             <input type="file" accept="image/*" onChange={handleImageUpload} />

//             {/* 編集用UI (簡易版) */}
//             {editableData.length > 0 && (
//                 <div>
//                     <h2>Edit Data</h2>
//                     <table>
//                         <thead>
//                             <tr>
//                                 {Object.keys(editableData[0]).map(key => (
//                                     <th key={key}>{key}</th>
//                                 ))}
//                             </tr>
//                         </thead>
//                         <tbody>
//                             {editableData.map((row, rowIndex) => (
//                                 <tr key={rowIndex}>
//                                     {Object.keys(row).map(key => (
//                                         <td key={key}>
//                                             <input
//                                                 value={String(row[key])}
//                                                 onChange={e => handleEditDataChange(rowIndex, key, e.target.value)}
//                                             />
//                                         </td>
//                                     ))}
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                 </div>
//             )}

//             <div ref={ganttRef} />
//             <button onClick={printChartAsPDF}>Print Gantt Chart (PDF)</button>
//         </div>
//     );
// }



// // app/page.tsx
// "use client";
// import { useState, useRef, ChangeEvent,   } from 'react';
// import * as XLSX from 'xlsx';
// // import { Chart, ChartData, registerables } from 'chart.js'; // Chart.jsは使用しない
// // import { Chart as ChartJS } from 'chart.js/auto';
// // import { Line } from 'react-chartjs-2'; // Lineは使用しない
// // import Tesseract from 'tesseract.js';
// import html2canvas from 'html2canvas';
// import jsPDF from 'jspdf';
// import FrappeGantt from 'frappe-gantt'; // Frappe Ganttを使用する場合
// // import { Gantt } from 'react-gantt'; // react-ganttを使用する場合
// import Tesseract from 'tesseract.js';

// // Chart.register(...registerables); // Chart.jsは使用しない

// // Excelデータの型定義を修正
// type ExcelData = (string | number)[][];

// // ガントチャートデータの型定義
// type GanttTask = {
//     id: string;
//     name: string;
//     start: string;
//     end: string;
//     progress: number;
//     // ... 必要に応じて他のプロパティを追加
// };

// export default function Home() {
//     // const [excelData, setExcelData] = useState<ExcelData | null>(null);
//     const [ganttData, setGanttData] = useState<GanttTask[] | null>(null);
//     // const chartRef = useRef<ChartJS<'line'>>(null); // Lineは使用しない
//     const ganttRef = useRef<HTMLDivElement>(null); // ガントチャート表示用のdiv要素の参照

//     const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
//         const file = event.target.files?.[0];
//         if (!file) return;

//         const text = await extractTextFromImage(file);
//         const csv = convertTextToCSV(text);
//         const workbook = XLSX.read(csv, { type: 'string' });
//         const sheetName = workbook.SheetNames[0];
//         const sheet = workbook.Sheets[sheetName];
//         const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as ExcelData;

//         // setExcelData(data);

//         // Excelデータからガントチャート用のデータを生成
//         const ganttTasks = createGanttData(data);
//         setGanttData(ganttTasks);
//     };

//     const extractTextFromImage = async (file: File):Promise<string> => {
//         // ... (OCR処理)
//         const reader = new FileReader();
//     reader.readAsDataURL(file);
//     return new Promise<string>((resolve, reject) => {
//         reader.onload = async () => {
//             try {
//                 const result = await Tesseract.recognize(reader.result as string, 'jpn');
//                 resolve(result.data.text);
//             } catch (error) {
//                 reject(error);
//             }
//         };
//         reader.onerror = (error) => reject(error);
//     });
//     };

//     const convertTextToCSV = (text: string):string => {
//         // ... (CSV変換処理)
//         return text.replace(/\s+/g, ',');
//     };

//     const createGanttData = (data: ExcelData): GanttTask[] => {
//         // Excelデータからガントチャート用のデータを作成
//         // この部分のロジックは、Excelデータの構造に大きく依存します
//         // 例：
//         const ganttTasks: GanttTask[] = [];
//         data.forEach((row, index) => {
//             if (index > 0) { // ヘッダー行をスキップ
//                 ganttTasks.push({
//                     id: String(index),
//                     name: String(row[0]),
//                     start: String(row[1]),
//                     end: String(row[2]),
//                 });
//             }
//         });
//         return ganttTasks;
//     };

//     const renderGanttChart = () => {
//         if (ganttRef.current && ganttData) {
//             // Frappe Ganttを使用する場合
//             const gantt = new FrappeGantt(ganttRef.current, ganttData, {
//                 // ... Frappe Ganttの設定
//             });

//             // react-ganttを使用する場合
//             // render(<Gantt tasks={ganttData} />, ganttRef.current);
//         }
//     };

//     // useEffect(() => {
//     //     renderGanttChart();
//     // }, [ganttData, renderGanttChart]); // ganttDataが変更されたらガントチャートを再描画

//     const printChartAsPDF = async () => {
//         if (ganttRef.current) {
//             const canvas = await html2canvas(ganttRef.current);
//             const imgData = canvas.toDataURL('image/png');
//             const pdf = new jsPDF();
//             const imgProps = pdf.getImageProperties(imgData);
//             const pdfWidth = pdf.internal.pageSize.getWidth();
//             const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
//             pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
//             pdf.save('gantt_chart.pdf');
//         }
//     };

//     return (
//         <div>
//             <input type="file" accept="image/*" onChange={handleImageUpload} />
//             <div ref={ganttRef} /> {/* ガントチャートを表示するdiv */}
//             {/* chartData && <Line data={chartData} ref={chartRef} /> */}
//             <button onClick={printChartAsPDF}>Print Gantt Chart (PDF)</button>
//         </div>
//     );
// }



// app/page.tsx
// "use client";
// import { useState, useRef, ChangeEvent, MouseEventHandler, useEffect } from 'react';
// import * as XLSX from 'xlsx';
// import { Chart, ChartData, registerables } from 'chart.js';
// import { Chart as ChartJS } from 'chart.js/auto';
// import { Line } from 'react-chartjs-2';
// import Tesseract from 'tesseract.js';
// import html2canvas from 'html2canvas';
// import jsPDF from 'jspdf';
// Chart.register(...registerables);

// // Excelデータの型定義を修正
// type ExcelData = (string | number)[][];

// // 計算結果の型定義
// type CalculatedData = {
//     sum: number;
// };

// export default function Home() {
//     const [excelData, setExcelData] = useState<ExcelData | null>(null);
//     const [calculatedData, setCalculatedData] = useState<CalculatedData | null>(null);
//     const [chartData, setChartData] = useState<ChartData<"line"> | null>(null);
//     const chartRef = useRef<ChartJS<'line'>>(null);

//     const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
//         const file = event.target.files?.[0];
//         if (!file) return;

//         const text = await extractTextFromImage(file);
//         const csv = convertTextToCSV(text);
//         const workbook = XLSX.read(csv, { type: 'string' });
//         const sheetName = workbook.SheetNames[0];
//         const sheet = workbook.Sheets[sheetName];
//         const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as ExcelData;

//         setExcelData(data);
//     };

//     const extractTextFromImage = async (file: File) => {
//         const reader = new FileReader();
//         reader.readAsDataURL(file);
//         return new Promise<string>((resolve, reject) => {
//             reader.onload = async () => {
//                 try {
//                     const result = await Tesseract.recognize(reader.result as string, 'jpn');
//                     resolve(result.data.text);
//                 } catch (error) {
//                     reject(error);
//                 }
//             };
//             reader.onerror = (error) => reject(error);
//         });
//     };

//     const convertTextToCSV = (text: string) => {
//         return text.replace(/\s+/g, ',');
//     };

//     const handleCalculate: MouseEventHandler<HTMLButtonElement> = () => {
//         if (!excelData) return;

//         const calculated = calculateData(excelData);
//         setCalculatedData(calculated);

//         const chart = createChartData(calculated);
//         setChartData(chart);
//     };

//     const calculateData = (data: ExcelData): CalculatedData => {
//         let sum = 0;
//         for (let i = 1; i < data.length; i++) {
//             sum += parseInt(String(data[i][1]));
//         }
//         return { sum };
//     };

//     const createChartData = (data: CalculatedData): ChartData<"line"> => {
//         return {
//             labels: ['Result'],
//             datasets: [
//                 {
//                     label: 'Calculation Result',
//                     data: [data.sum],
//                     borderColor: 'rgb(75, 192, 192)',
//                     tension: 0.1,
//                 },
//             ],
//         };
//     };

//     const printChartAsPDF = async () => {
//         if (chartRef.current) {
//             const canvas = await html2canvas(chartRef.current.canvas);
//             const imgData = canvas.toDataURL('image/png');
//             const pdf = new jsPDF();
//             const imgProps = pdf.getImageProperties(imgData);
//             const pdfWidth = pdf.internal.pageSize.getWidth();
//             const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
//             pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
//             pdf.save('chart.pdf');
//         }
//     };

//     return (
//         <div>
//             <input type="file" accept="image/*" onChange={handleImageUpload} />
//             {excelData && <ExcelTable data={excelData} />}
//             <button onClick={handleCalculate}>Calculate</button>
//             {calculatedData && <p>Sum: {calculatedData.sum}</p>}
//             {chartData && <Line data={chartData} ref={chartRef} />}
//             <button onClick={printChartAsPDF}>Print Chart (PDF)</button>
//         </div>
//     );
// }

// // ExcelTableコンポーネントの型定義
// type ExcelTableProps = {
//     data: ExcelData;
// };

// const ExcelTable: React.FC<ExcelTableProps> = ({ data }) => {
//     return (
//         <table>
//             <tbody>
//                 {data.map((row, rowIndex) => (
//                     <tr key={rowIndex}>
//                         {row.map((cell, cellIndex) => (
//                             <td key={cellIndex}>{typeof cell === 'string' || typeof cell === 'number' ? cell : ''}</td>
//                         ))}
//                     </tr>
//                 ))}
//             </tbody>
//         </table>
//     );
// };






// app/page.tsx
// "use client";
// import { useState, useRef, ChangeEvent, MouseEventHandler, useEffect } from 'react';
// import * as XLSX from 'xlsx';
// import { Chart, ChartData, registerables, ChartType } from 'chart.js';
// // import { useRef } from 'react';
// import { Chart as ChartJS } from 'chart.js/auto';
// import { Line } from 'react-chartjs-2';
// import Tesseract from 'tesseract.js';
// import html2canvas from 'html2canvas';
// import jsPDF from 'jspdf';

// Chart.register(...registerables);

// // Excelデータの型定義を修正
// type ExcelData = (string | number)[][];

// // 計算結果の型定義
// type CalculatedData = {
//     sum: number;
// };


// // ... (ExcelTableコンポーネント)

// // app/page.tsx
// // ... (上記のコード)

// const handleCalculate: MouseEventHandler<HTMLButtonElement> = () => {
//   if (!excelData) return;

//   // Excelデータの計算処理
//   const calculated = calculateData(excelData);
//   setCalculatedData(calculated);

//   // 計算結果からグラフデータを作成
//   const chart = createChartData(calculated);
//   setChartData(chart);
// };

// const calculateData = (data: ExcelData): CalculatedData => {
//   // 例：特定の列の数値を合計する
//   let sum = 0;
//   for (let i = 1; i < data.length; i++) {
//       sum += parseInt(String(data[i][1])); // 2列目の数値を合計
//   }
//   return { sum };
// };

// const createChartData = (data: CalculatedData): ChartData<"line"> => {
//   return {
//       labels: ['Result'],
//       datasets: [
//           {
//               label: 'Calculation Result',
//               data: [data.sum],
//               borderColor: 'rgb(75, 192, 192)',
//               tension: 0.1,
//           },
//       ],
//   };
// };
// // ... (printChartAsPDF)

// // app/page.tsx
// // ... (上記のコード)

//     // グラフをPDFで印刷する関数
//     const printChartAsPDF = async () => {
//       if (chartRef.current) {
//           const canvas = await html2canvas(chartRef.current.canvas);
//           const imgData = canvas.toDataURL('image/png');
//           const pdf = new jsPDF();
//           const imgProps = pdf.getImageProperties(imgData);
//           const pdfWidth = pdf.internal.pageSize.getWidth();
//           const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
//           pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
//           pdf.save('chart.pdf');
//       }
//       return (
//           <div>
//               {/* ... (UI) */}
//               <button onClick={printChartAsPDF}>Print Chart (PDF)</button>
//           </div>
//       );
//   };




// export default function Home() {
//     const [excelData, setExcelData] = useState<ExcelData | null>(null);
//     const [calculatedData, setCalculatedData] = useState<CalculatedData | null>(null);
//     const [chartData, setChartData] = useState<ChartData<"line"> | null>(null);
//     const chartRef = useRef<ChartJS<'line'>>(null);

//     const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
//         const file = event.target.files?.[0];
//         if (!file) return;

//         // 画像からテキストを抽出
//         const text = await extractTextFromImage(file);

//         // テキストからExcelデータ（CSV形式）を生成
//         const csv = convertTextToCSV(text);

//         // CSVデータをExcelデータ（JSON形式）に変換
//         const workbook = XLSX.read(csv, { type: 'string' });
//         const sheetName = workbook.SheetNames[0];
//         const sheet = workbook.Sheets[sheetName];
//         const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as ExcelData;

//         setExcelData(data);
//     };

//     // 画像からテキストを抽出する関数（OCR）
//     const extractTextFromImage = async (file: File) => {
//         const reader = new FileReader();
//         reader.readAsDataURL(file);
//         return new Promise<string>((resolve, reject) => {
//             reader.onload = async () => {
//                 try {
//                     const result = await Tesseract.recognize(reader.result as string, 'jpn');
//                     resolve(result.data.text);
//                 } catch (error) {
//                     reject(error);
//                 }
//             };
//             reader.onerror = (error) => reject(error);
//         });
//     };

//     // テキストからCSVデータを生成する関数
//     const convertTextToCSV = (text: string) => {
//         // 例：テキストをカンマ区切りにする
//         return text.replace(/\s+/g, ',');
//     };

//     // ... (handleCalculate, calculateData, createChartData)

//     // グラフをPDFで印刷する関数
//     const printChartAsPDF = async () => {
//         if (chartRef.current) {
//             const canvas = await html2canvas(chartRef.current.canvas);
//             const imgData = canvas.toDataURL('image/png');
//             const pdf = new jsPDF();
//             const imgProps = pdf.getImageProperties(imgData);
//             const pdfWidth = pdf.internal.pageSize.getWidth();
//             const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
//             pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
//             pdf.save('chart.pdf');
//         }
//     };

//     return (
//         <div>
//             <input type="file" accept="image/*" onChange={handleImageUpload} />
//             {excelData && <ExcelTable data={excelData} />}
//             <button onClick={handleCalculate}>Calculate</button>
//             {calculatedData && <p>Sum: {calculatedData.sum}</p>}
//             {chartData && <Line data={chartData} ref={chartRef} />}
//             <button onClick={printChartAsPDF}>Print Chart (PDF)</button>
//         </div>
//     );
// }



// ... (ExcelTableコンポーネント)


// // app/page.tsx
// "use client";
// // import { useState, ChangeEvent,MouseEventHandler } from 'react';
// import { useRef,useState,ChangeEvent,MouseEventHandler } from 'react';

// import * as XLSX from 'xlsx';
// import {Chart,registerables, ChartData,  } from 'chart.js';
// import { Line } from 'react-chartjs-2';
// import { Chart as ChartJS} from 'chart.js/auto';
// Chart.register(...registerables);



// // Excelデータの型定義
// type ExcelData = (string | number)[][]; // 必要に応じて具体的な型に修正してください

// // 計算結果の型定義
// type CalculatedData = {
//     sum: number;
// };

// export default function Home() {
//     const [excelData, setExcelData] = useState<ExcelData | null>(null);
//     const [calculatedData, setCalculatedData] = useState<CalculatedData | null>(null);
//     const [chartData, setChartData] = useState<ChartData<"line"> | null>(null);
//     const chartRef = useRef<ChartJS<'line'>>(null);

//     const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
//         const file = event.target.files?.[0];
//         if (!file) return;

//         // 画像からテキストを抽出する処理（OCR）
//         // 例：Tesseract.jsなどのライブラリを使用
//         const text = await extractTextFromImage(file);

//         // テキストからExcelデータ（CSV形式など）を生成
//         const csv = convertTextToCSV(text);

//         // CSVデータをExcelデータ（JSON形式）に変換
//         const workbook = XLSX.read(csv, { type: 'string' });
//         const sheetName = workbook.SheetNames[0];
//         const sheet = workbook.Sheets[sheetName];
//         const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as ExcelData;

//         setExcelData(data);
//     };

//     // 画像からテキストを抽出する関数（OCR）
//     const extractTextFromImage = async (file: File) => {
//         // 例：Tesseract.jsを使用する場合
//         // const { createWorker } = require('tesseract.js');
//         // const worker = await createWorker('eng');
//         // const ret = await worker.recognize(file);
//         // await worker.terminate();
//         // return ret.data.text;

//         // 今回はサンプルとして、ファイル名を返す
//         return file.name;
//     };

//     // テキストからCSVデータを生成する関数
//     const convertTextToCSV = (text: string) => {
//         // 例：テキストをカンマ区切りにする
//         return text.replace(/\s+/g, ',');
//     };

//     const handleCalculate: MouseEventHandler<HTMLButtonElement> = () => {
//         if (!excelData) return;

//         // Excelデータの計算処理
//         const calculated = calculateData(excelData);
//         setCalculatedData(calculated);

//         // 計算結果からグラフデータを作成
//         const chart = createChartData(calculated);
//         setChartData(chart);
//     };

//     const calculateData = (data: ExcelData): CalculatedData => {
//         // 例：特定の列の数値を合計する
//         let sum = 0;
//         for (let i = 1; i < data.length; i++) {
//             sum += parseInt(String(data[i][1])); // 2列目の数値を合計
//         }
//         return { sum };
//     };

//     const createChartData = (data: CalculatedData): ChartData<"line"> => {
//         return {
//             labels: ['Result'],
//             datasets: [
//                 {
//                     label: 'Calculation Result',
//                     data: [data.sum],
//                     borderColor: 'rgb(75, 192, 192)',
//                     tension: 0.1,
//                 },
//             ],
//         };
//     };

//     const handlePrint: MouseEventHandler<HTMLButtonElement> = () => {
//         if (chartRef && chartRef.current) {
//             const chartImage = chartRef.current.toBase64Image();
//             const printWindow = window.open('', '_blank');
//             if(printWindow){

//               printWindow.document.write(`
//                   <html>
//                       <head><title>Print Chart</title></head>
//                       <body>
//                           <img src="${chartImage}" />
//                       </body>
//                   </html>
//               `);
//               printWindow.document.close();
//               printWindow.print();
//             }
//         }
//     };

//     return (
//         <div>
//             <input type="file" accept="image/*" onChange={handleImageUpload} />
//             {excelData && <ExcelTable data={excelData} />}
//             <button onClick={handleCalculate}>Calculate</button>
//             {calculatedData && <p>Sum: {calculatedData.sum}</p>}
//             {chartData && <Line data={chartData} ref={chartRef} />}
//             <button onClick={handlePrint}>Print Chart</button>
//         </div>
//     );
// }

// // ExcelTableコンポーネントのpropsの型定義
// type ExcelTableProps = {
//     data: ExcelData;
// };

// const ExcelTable: React.FC<ExcelTableProps> = ({ data }) => {
//     return (
//         <table>
//             <tbody>
//                 {data.map((row, rowIndex) => (
//                     <tr key={rowIndex}>
//                         {row.map((cell, cellIndex) => (
//                             <td key={cellIndex}>{typeof cell === 'string' || typeof cell === 'number' ? cell : ''}</td>
//                         ))}
//                     </tr>
//                 ))}
//             </tbody>
//         </table>
//     );
// };


// import Image from "next/image";

// export default function Home() {
//   return (
//     <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
//       <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
//         <Image
//           className="dark:invert"
//           src="/next.svg"
//           alt="Next.js logo"
//           width={180}
//           height={38}
//           priority
//         />
//         <ol className="list-inside list-decimal text-sm/6 text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
//           <li className="mb-2 tracking-[-.01em]">
//             Get started by editing{" "}
//             <code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-[family-name:var(--font-geist-mono)] font-semibold">
//               app/page.tsx
//             </code>
//             .
//           </li>
//           <li className="tracking-[-.01em]">
//             Save and see your changes instantly.
//           </li>
//         </ol>

//         <div className="flex gap-4 items-center flex-col sm:flex-row">
//           <a
//             className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
//             href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//             target="_blank"
//             rel="noopener noreferrer"
//           >
//             <Image
//               className="dark:invert"
//               src="/vercel.svg"
//               alt="Vercel logomark"
//               width={20}
//               height={20}
//             />
//             Deploy now
//           </a>
//           <a
//             className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
//             href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//             target="_blank"
//             rel="noopener noreferrer"
//           >
//             Read our docs
//           </a>
//         </div>
//       </main>
//       <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
//         <a
//           className="flex items-center gap-2 hover:underline hover:underline-offset-4"
//           href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           <Image
//             aria-hidden
//             src="/file.svg"
//             alt="File icon"
//             width={16}
//             height={16}
//           />
//           Learn
//         </a>
//         <a
//           className="flex items-center gap-2 hover:underline hover:underline-offset-4"
//           href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           <Image
//             aria-hidden
//             src="/window.svg"
//             alt="Window icon"
//             width={16}
//             height={16}
//           />
//           Examples
//         </a>
//         <a
//           className="flex items-center gap-2 hover:underline hover:underline-offset-4"
//           href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           <Image
//             aria-hidden
//             src="/globe.svg"
//             alt="Globe icon"
//             width={16}
//             height={16}
//           />
//           Go to nextjs.org →
//         </a>
//       </footer>
//     </div>
//   );
// }
