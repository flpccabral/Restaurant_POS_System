const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

class Exporter {
  /**
   * Salva dados em formato JSON
   * @param {Object|Array} data - Dados para salvar
   * @param {string} outputDir - Diretório de saída
   * @param {string} prefix - Prefixo do nome do arquivo
   * @returns {string} Caminho do arquivo salvo
   */
  static saveJSON(data, outputDir, prefix = 'data') {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
    const filename = `${prefix}_${timestamp}.json`;
    const filepath = path.join(outputDir, filename);

    const output = {
      metadata: {
        exportedAt: dayjs().toISOString(),
        source: 'ifood-scraper',
        recordCount: Array.isArray(data) ? data.length : 1,
      },
      data,
    };

    fs.writeFileSync(filepath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`💾 JSON salvo: ${filepath} (${Array.isArray(data) ? data.length : 1} registros)`);

    // Também salvar um arquivo "latest" para fácil acesso
    const latestPath = path.join(outputDir, `${prefix}_latest.json`);
    fs.writeFileSync(latestPath, JSON.stringify(output, null, 2), 'utf-8');

    return filepath;
  }

  /**
   * Salva dados em formato CSV
   * @param {Array<Object>} data - Array de objetos para converter
   * @param {string} outputDir - Diretório de saída
   * @param {string} prefix - Prefixo do nome do arquivo
   * @returns {string} Caminho do arquivo salvo
   */
  static saveCSV(data, outputDir, prefix = 'data') {
    if (!Array.isArray(data) || data.length === 0) {
      console.log('⚠️  Sem dados para exportar CSV');
      return null;
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
    const filename = `${prefix}_${timestamp}.csv`;
    const filepath = path.join(outputDir, filename);

    // Flatten nested objects for CSV
    const flatData = data.map((item) => Exporter._flattenObject(item));

    // Pegar todas as colunas únicas
    const headers = [...new Set(flatData.flatMap((item) => Object.keys(item)))];

    // Montar CSV
    const csvLines = [
      headers.join(';'), // Header (usar ; como separador para compatibilidade com Excel BR)
      ...flatData.map((item) =>
        headers.map((h) => {
          const val = item[h] ?? '';
          // Escapar valores com aspas se contiverem ; ou "
          const str = String(val);
          if (str.includes(';') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(';')
      ),
    ];

    fs.writeFileSync(filepath, '\uFEFF' + csvLines.join('\n'), 'utf-8'); // BOM para Excel
    console.log(`📊 CSV salvo: ${filepath} (${data.length} registros)`);

    return filepath;
  }

  /**
   * Carrega dados de um export anterior para merge incremental
   * @param {string} outputDir - Diretório de saída
   * @param {string} prefix - Prefixo do nome do arquivo
   * @returns {Array} Dados existentes ou array vazio
   */
  static loadExisting(outputDir, prefix) {
    const latestPath = path.join(outputDir, `${prefix}_latest.json`);
    try {
      if (fs.existsSync(latestPath)) {
        const content = JSON.parse(fs.readFileSync(latestPath, 'utf-8'));
        return content.data || [];
      }
    } catch (e) {
      console.log('⚠️  Erro ao carregar dados existentes');
    }
    return [];
  }

  /**
   * Faz merge de novos dados com existentes (sem duplicação por chave)
   * @param {Array} existing - Dados existentes
   * @param {Array} newData - Novos dados
   * @param {string} key - Campo chave para deduplicação
   * @returns {Array} Dados mergeados
   */
  static mergeData(existing, newData, key = 'orderNumber') {
    const existingMap = new Map(existing.map((item) => [item[key], item]));

    for (const item of newData) {
      existingMap.set(item[key], item); // Sobrescreve se já existe
    }

    const merged = Array.from(existingMap.values());
    console.log(
      `🔄 Merge: ${existing.length} existentes + ${newData.length} novos = ${merged.length} total`
    );
    return merged;
  }

  /**
   * Flattens a nested object for CSV export
   * @param {Object} obj - Object to flatten
   * @param {string} prefix - Key prefix for nested keys
   * @returns {Object} Flattened object
   */
  static _flattenObject(obj, prefix = '') {
    const result = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, Exporter._flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        result[newKey] = value
          .map((v) => (typeof v === 'object' ? JSON.stringify(v) : v))
          .join(' | ');
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }

  /**
   * Imprime resumo dos dados extraídos
   */
  static printSummary(label, data) {
    console.log('\n' + '═'.repeat(50));
    console.log(`📋 ${label}`);
    console.log('═'.repeat(50));

    if (Array.isArray(data)) {
      console.log(`   Total de registros: ${data.length}`);
      if (data.length > 0) {
        console.log(`   Campos: ${Object.keys(data[0]).join(', ')}`);
      }
    } else if (typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          console.log(`   ${key}:`);
          for (const [k, v] of Object.entries(value)) {
            console.log(`     ${k}: ${v}`);
          }
        } else {
          console.log(`   ${key}: ${Array.isArray(value) ? `[${value.length} items]` : value}`);
        }
      }
    }
    console.log('═'.repeat(50) + '\n');
  }
}

module.exports = Exporter;
