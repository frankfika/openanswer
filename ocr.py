#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import json
import base64
from io import BytesIO
from PIL import Image
import os
import cv2
import numpy as np
import traceback

# 尝试导入OCR库，按优先级排序
USE_EASYOCR = False
USE_PADDLE = False
USE_TESSERACT = False

print("开始加载OCR引擎...")
try:
    import easyocr
    USE_EASYOCR = True
    print("成功加载EasyOCR引擎")
except ImportError as e:
    print(f"加载EasyOCR失败: {str(e)}")
    try:
        from paddleocr import PaddleOCR
        USE_PADDLE = True
        print("成功加载PaddleOCR引擎")
    except ImportError as e:
        print(f"加载PaddleOCR失败: {str(e)}")
        try:
            import pytesseract
            USE_TESSERACT = True
            print("成功加载Tesseract引擎")
        except ImportError as e:
            print(f"加载Tesseract失败: {str(e)}")
            print(json.dumps({
                "success": False,
                "error": "未安装OCR库，请安装easyocr、paddleocr或pytesseract"
            }))
            sys.exit(1)

def preprocess_image(image):
    """图像预处理，提高OCR识别率"""
    print("开始图像预处理...")
    # 转换为OpenCV格式
    img_array = np.array(image)
    img = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    
    # 放大图像
    scale = 1.5
    img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    
    # 转为灰度图
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 自适应阈值二值化
    binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
    
    # 降噪
    kernel = np.ones((1, 1), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    
    print("图像预处理完成")
    return binary, img

def recognize_text(base64_image):
    try:
        print("开始OCR识别...")
        # 解码base64图像
        image_data = base64.b64decode(base64_image.split(',')[1] if ',' in base64_image else base64_image)
        image = Image.open(BytesIO(image_data))
        
        # 保存为临时文件
        temp_path = 'temp_ocr_image.png'
        image.save(temp_path)
        
        # 图像预处理
        processed_image, color_image = preprocess_image(image)
        cv2.imwrite('temp_processed_image.png', processed_image)
        
        text = ""
        engine = "unknown"
        
        # 使用EasyOCR进行识别
        if USE_EASYOCR:
            print("使用EasyOCR进行识别...")
            try:
                # 初始化EasyOCR读取器
                reader = easyocr.Reader(['ch_sim', 'en'], gpu=False)
                
                # 使用原始彩色图像进行识别，EasyOCR内部会进行预处理
                result = reader.readtext(color_image)
                
                # 提取文本
                texts = []
                for detection in result:
                    texts.append(detection[1])  # 提取识别的文本
                
                text = '\n'.join(texts)
                engine = "easyocr"
                print(f"EasyOCR识别完成，识别到{len(texts)}个文本区域")
            except Exception as e:
                print(f"EasyOCR识别失败: {str(e)}")
                print(traceback.format_exc())
                raise
        
        # 使用PaddleOCR进行识别
        elif USE_PADDLE:
            print("使用PaddleOCR进行识别...")
            ocr = PaddleOCR(use_angle_cls=True, lang="ch", use_gpu=False)
            result = ocr.ocr('temp_processed_image.png', cls=True)
            
            # 提取文本
            texts = []
            for line in result:
                for item in line:
                    texts.append(item[1][0])  # 提取识别的文本
            
            text = '\n'.join(texts)
            engine = "paddleocr"
            print(f"PaddleOCR识别完成，识别到{len(texts)}个文本区域")
        
        # 使用Tesseract进行识别
        elif USE_TESSERACT:
            print("使用Tesseract进行识别...")
            # 设置Tesseract语言为中文+英文
            text = pytesseract.image_to_string(
                Image.open('temp_processed_image.png'), 
                lang='chi_sim+eng',
                config='--psm 6'
            )
            engine = "tesseract"
            print("Tesseract识别完成")
        
        # 清理临时文件
        if os.path.exists(temp_path):
            os.remove(temp_path)
        if os.path.exists('temp_processed_image.png'):
            os.remove('temp_processed_image.png')
        
        # 后处理文本
        text = post_process_text(text)
        
        print(f"OCR识别完成，引擎: {engine}, 文本长度: {len(text)}")
        if len(text) > 0:
            print(f"识别文本前100个字符: {text[:100]}")
        else:
            print("未识别到文本")
            
        return {
            "success": True,
            "text": text,
            "engine": engine
        }
    except Exception as e:
        print(f"OCR识别失败: {str(e)}")
        print(traceback.format_exc())
        return {
            "success": False,
            "error": str(e)
        }

def post_process_text(text):
    """文本后处理，修复常见OCR错误"""
    if not text:
        return text
    
    print("开始文本后处理...")
    
    # 移除多余的空格和换行，但保留段落结构
    text = text.replace('\n\n', '[PARA]')
    text = text.replace('\n', ' ')
    text = text.replace('[PARA]', '\n\n')
    
    # 修复中文标点符号
    text = text.replace('，', ',')
    text = text.replace('。', '.')
    text = text.replace('：', ':')
    text = text.replace('；', ';')
    text = text.replace('！', '!')
    text = text.replace('？', '?')
    text = text.replace('（', '(')
    text = text.replace('）', ')')
    text = text.replace('【', '[')
    text = text.replace('】', ']')
    text = text.replace('《', '<')
    text = text.replace('》', '>')
    text = text.replace('"', '"')
    text = text.replace('"', '"')
    text = text.replace(''', '\'')
    text = text.replace(''', '\'')
    
    # 修复常见的中文OCR错误
    text = text.replace('曰', '日')
    text = text.replace('己', '已')
    text = text.replace('末', '未')
    text = text.replace('象', '像')
    text = text.replace('又', '叉')
    
    # 移除非打印字符
    text = text.replace('[^\x20-\x7E\u4E00-\u9FFF\n]', '')
    
    print("文本后处理完成")
    return text.strip()

if __name__ == "__main__":
    # 从命令行参数获取base64图像
    if len(sys.argv) > 1:
        print("从命令行参数获取图像数据...")
        base64_image = sys.argv[1]
        result = recognize_text(base64_image)
        print(json.dumps(result, ensure_ascii=False))
    else:
        # 从标准输入读取
        print("从标准输入读取图像数据...")
        base64_image = sys.stdin.read().strip()
        result = recognize_text(base64_image)
        print(json.dumps(result, ensure_ascii=False)) 