// app/page.tsx
"use client";
import { useState, useRef, ChangeEvent, MouseEventHandler } from 'react';
import * as XLSX from 'xlsx';
import { Line } from 'react-chartjs-2';
import { Chart, registerables, ChartData } from 'chart.js';
Chart.register(...registerables);

// Excelデータの型定義
type ExcelData = any[][]; // 必要に応じて具体的な型に修正してください

// 計算結果の型定義
type CalculatedData = {
    sum: number;
};

export default function Home() {
    const [excelData, setExcelData] = useState<ExcelData | null>(null);
    const [calculatedData, setCalculatedData] = useState<CalculatedData | null>(null);
    const [chartData, setChartData] = useState<ChartData<"line"> | null>(null);
    const chartRef = useRef<any>(null);

    const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // 画像からテキストを抽出する処理（OCR）
        // 例：Tesseract.jsなどのライブラリを使用
        const text = await extractTextFromImage(file);

        // テキストからExcelデータ（CSV形式など）を生成
        const csv = convertTextToCSV(text);

        // CSVデータをExcelデータ（JSON形式）に変換
        const workbook = XLSX.read(csv, { type: 'string' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        setExcelData(data);
    };

    // 画像からテキストを抽出する関数（OCR）
    const extractTextFromImage = async (file: File) => {
        // 例：Tesseract.jsを使用する場合
        // const { createWorker } = require('tesseract.js');
        // const worker = await createWorker('eng');
        // const ret = await worker.recognize(file);
        // await worker.terminate();
        // return ret.data.text;

        // 今回はサンプルとして、ファイル名を返す
        return file.name;
    };

    // テキストからCSVデータを生成する関数
    const convertTextToCSV = (text: string) => {
        // 例：テキストをカンマ区切りにする
        return text.replace(/\s+/g, ',');
    };

    const handleCalculate: MouseEventHandler<HTMLButtonElement> = () => {
        if (!excelData) return;

        // Excelデータの計算処理
        const calculated = calculateData(excelData);
        setCalculatedData(calculated);

        // 計算結果からグラフデータを作成
        const chart = createChartData(calculated);
        setChartData(chart);
    };

    const calculateData = (data: ExcelData): CalculatedData => {
        // 例：特定の列の数値を合計する
        let sum = 0;
        for (let i = 1; i < data.length; i++) {
            sum += parseInt(data[i][1]); // 2列目の数値を合計
        }
        return { sum };
    };

    const createChartData = (data: CalculatedData): ChartData<"line"> => {
        return {
            labels: ['Result'],
            datasets: [
                {
                    label: 'Calculation Result',
                    data: [data.sum],
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                },
            ],
        };
    };

    const handlePrint: MouseEventHandler<HTMLButtonElement> = () => {
        if (chartRef && chartRef.current) {
            const chartImage = chartRef.current.toBase64Image();
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head><title>Print Chart</title></head>
                    <body>
                        <img src="${chartImage}" />
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    };

    return (
        <div>
            <input type="file" accept="image/*" onChange={handleImageUpload} />
            {excelData && <ExcelTable data={excelData} />}
            <button onClick={handleCalculate}>Calculate</button>
            {calculatedData && <p>Sum: {calculatedData.sum}</p>}
            {chartData && <Line data={chartData} ref={chartRef} />}
            <button onClick={handlePrint}>Print Chart</button>
        </div>
    );
}

// ExcelTableコンポーネントのpropsの型定義
type ExcelTableProps = {
    data: ExcelData;
};

const ExcelTable: React.FC<ExcelTableProps> = ({ data }) => {
    return (
        <table>
            <tbody>
                {data.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                            <td key={cellIndex}>{cell}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};


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
