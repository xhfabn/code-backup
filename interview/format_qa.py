#!/usr/bin/env python3
# -*- coding: utf-8 -*-

def format_qa_file(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    formatted_lines = []
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # 跳过空行
        if not line:
            i += 1
            continue
        
        # 如果是以"？"结尾，说明是问题
        if line.endswith('？'):
            formatted_lines.append(line)
            i += 1
            
            # 收集答案（直到遇到下一个问题或空行）
            answer_lines = []
            while i < len(lines):
                next_line = lines[i].strip()
                
                # 如果遇到新问题，停止收集答案
                if next_line.endswith('？'):
                    break
                
                # 如果不是空行，加入答案
                if next_line:
                    answer_lines.append(next_line)
                
                i += 1
            
            # 写入答案
            if answer_lines:
                formatted_lines.append(' '.join(answer_lines))
            
            # 添加空行分隔
            formatted_lines.append('')
        else:
            # 如果不是问题开头，可能是标题或其他内容
            formatted_lines.append(line)
            formatted_lines.append('')
            i += 1
    
    # 写入输出文件
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(formatted_lines))
    
    print(f"格式化完成！输出文件：{output_file}")

if __name__ == '__main__':
    input_file = '/Users/wujiawei/JavaProjects/0212_recode/interview/33.txt'
    output_file = '/Users/wujiawei/JavaProjects/0212_recode/interview/33_formatted.txt'
    format_qa_file(input_file, output_file)

